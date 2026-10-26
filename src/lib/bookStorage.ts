import { BOOK_KEY, loadBook } from './ledger'
import type { Book } from './ledger'

export interface BookStorage {
  key: string
  load: () => { book: Book; error?: string; migrated?: boolean }
  read: () => string | null
  write: (raw: string) => void
}

export const localBookStorage: BookStorage = {
  key: BOOK_KEY,
  load: loadBook,
  read: () => localStorage.getItem(BOOK_KEY),
  write: (raw) => localStorage.setItem(BOOK_KEY, raw),
}
