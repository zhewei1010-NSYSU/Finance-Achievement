import { createClient } from '@supabase/supabase-js'
import { validBook } from './ledger'
import type { Book } from './ledger'
import type { BookStorage } from './bookStorage'
import { defaultSupabaseUrl, defaultSupabasePublishableKey } from './supabaseConfig'

const url = import.meta.env.VITE_SUPABASE_URL || defaultSupabaseUrl
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || defaultSupabasePublishableKey
export const supabase = url && key ? createClient(url, key) : null

export type CloudRow = { book: Book; revision: number; mutation_id: string | null }
export type Draft = CloudRow & { owner: string; dirty: boolean; operation: string }
export interface CloudAPI {
  pull(): Promise<CloudRow | null>
  push(draft: Draft): Promise<CloudRow>
}
export const cloudAPI = (owner: string): CloudAPI => ({
  async pull() {
    const { data, error } = await supabase!
      .from('finance_books')
      .select('book,revision,mutation_id')
      .eq('user_id', owner)
      .maybeSingle()
    if (error) throw error
    return data ? { ...data, book: validBook(data.book) } : null
  },
  async push(draft) {
    const { data, error } = await supabase!.rpc('save_finance_book', {
      p_book: draft.book,
      p_expected_revision: draft.revision,
      p_mutation_id: draft.operation,
    })
    if (error) throw error
    return { ...data, book: validBook(data.book) }
  },
})

// Persist book + outbox atomically. No cloud data is written into the legacy local book.
export class CloudBookStore {
  readonly key: string
  draft: Draft | null = null
  status = '正在連線雲端，尚未確認同步狀態。'
  conflict = false
  blocked = false
  private running: Promise<void> | null = null
  private stopped = false
  onChange = () => {}
  onRemote = () => {}
  constructor(
    readonly owner: string,
    private api: CloudAPI,
    private disk: Storage = localStorage,
  ) {
    this.key = `finance-cloud.v1:${owner}`
    const raw = disk.getItem(this.key)
    if (raw) {
      const d = JSON.parse(raw) as Draft
      if (
        d.owner !== owner ||
        !Number.isSafeInteger(d.revision) ||
        d.revision < 0 ||
        typeof d.dirty !== 'boolean' ||
        typeof d.operation !== 'string'
      )
        throw new Error('本機雲端帳簿格式不正確，請保留資料並聯絡支援。')
      this.draft = { ...d, book: validBook(d.book) }
    }
  }
  private persist(draft: Draft) {
    this.disk.setItem(this.key, JSON.stringify(draft))
    this.draft = draft
  }
  get storage(): BookStorage {
    return {
      key: this.key,
      load: () => ({ book: this.draft!.book }),
      read: () => {
        const raw = this.disk.getItem(this.key)
        return raw ? JSON.stringify((JSON.parse(raw) as Draft).book) : null
      },
      write: (raw) => {
        if (this.stopped || this.blocked || this.conflict)
          throw new Error('同步衝突或帳號已切換，請先處理。')
        const book = validBook(JSON.parse(raw))
        if (JSON.stringify(this.draft!.book) === raw) return
        // A second tab can edit while this tab is open; never overwrite its outbox.
        const saved = this.disk.getItem(this.key)
        if (!saved || saved !== JSON.stringify(this.draft)) throw new Error('其他分頁已更新資料。')
        this.persist({ ...this.draft!, book, dirty: true, operation: crypto.randomUUID() })
        this.status = '已儲存於此裝置，尚未同步。'
        this.onChange()
        void this.sync()
      },
    }
  }
  stop() {
    this.stopped = true
  }
  async create(book: Book) {
    if (this.draft) throw new Error('已有帳簿，不能再次匯入。')
    this.persist({
      owner: this.owner,
      book: validBook(book),
      revision: 0,
      mutation_id: null,
      dirty: true,
      operation: crypto.randomUUID(),
    })
    this.onChange()
    await this.sync()
  }
  sync(): Promise<void> {
    if (this.stopped) return Promise.resolve()
    if (this.running) return this.running
    this.running = this.run().finally(() => {
      this.running = null
    })
    return this.running
  }
  private async run() {
    if (this.conflict || this.blocked || this.stopped) return
    try {
      this.status = this.draft?.dirty ? '同步中；完成前資料仍只在此裝置。' : '正在確認雲端版本…'
      this.onChange()
      while (this.draft?.dirty && !this.stopped) {
        const sent = { ...this.draft }
        const row = await this.api.push(sent)
        if (this.stopped) return
        if (this.disk.getItem(this.key) !== JSON.stringify(this.draft)) {
          this.blocked = true
          throw new Error('另一分頁已更新待同步資料，請重新整理。')
        }
        // Edits made during upload remain pending, against the newly acknowledged revision.
        this.persist({
          ...this.draft,
          revision: row.revision,
          mutation_id: row.mutation_id,
          dirty: this.draft.operation !== sent.operation,
        })
      }
      if (this.stopped) return
      const row = await this.api.pull()
      if (this.stopped) return
      // A local edit during pull wins locally and will be sent on the next serialized pass.
      if (this.draft?.dirty) {
        this.status = '已儲存於此裝置，尚未同步。'
        return
      }
      if (!row && this.draft) throw new Error('雲端帳簿不存在；本機副本保留，請勿清除資料。')
      if (row && (!this.draft || row.revision !== this.draft.revision)) {
        if (this.draft && this.disk.getItem(this.key) !== JSON.stringify(this.draft)) {
          this.blocked = true
          throw new Error('另一分頁已更新資料，請重新整理。')
        }
        this.persist({ ...row, owner: this.owner, dirty: false, operation: crypto.randomUUID() })
        this.onRemote()
      }
      this.status = row ? '已確認與雲端同步。' : '雲端尚無帳簿，請先選擇匯入方式。'
    } catch (e) {
      const error = e as { code?: string; message?: string }
      this.conflict = error.code === '40001'
      this.status = this.conflict
        ? '同步衝突：另一裝置已修改帳簿。本機變更保留，尚未上傳；請先下載備份再選擇雲端版本。'
        : `同步未完成；本機資料保留。${error.message ?? '請檢查網路或重新登入後重試。'}`
    } finally {
      this.onChange()
      // Do not auto-loop after errors. Retry on network recovery, periodic check or user request.
    }
  }
  async useCloud() {
    const row = await this.api.pull()
    if (this.stopped) return
    if (!row) throw new Error('雲端尚無帳簿。')
    this.persist({ ...row, owner: this.owner, dirty: false, operation: crypto.randomUUID() })
    this.conflict = false
    this.blocked = false
    this.status = '已改用雲端版本；原待同步版本請保存在下載的備份中。'
    this.onRemote()
    this.onChange()
  }
}
