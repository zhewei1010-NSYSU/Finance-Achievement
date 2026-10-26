import { beforeEach, expect, test } from 'vitest'
import { CloudBookStore } from './cloud'
import type { CloudAPI, CloudRow } from './cloud'
import { emptyBook } from './ledger'
beforeEach(() => localStorage.clear())
function server() {
  let row: CloudRow | null = null
  const api: CloudAPI = {
    pull: async () => row,
    push: async (d) => {
      if (row?.mutation_id === d.operation) return row
      if ((row?.revision ?? 0) !== d.revision) throw { code: '40001' }
      row = { book: d.book, revision: d.revision + 1, mutation_id: d.operation }
      return row
    },
  }
  return api
}
test('explicit migration copies the book; remote updates propagate without touching legacy data', async () => {
  localStorage.setItem('my-finance-book.v3', 'original')
  const api = server()
  const a = new CloudBookStore('alice', api)
  await a.sync()
  expect(a.draft).toBeNull()
  await a.create(emptyBook())
  const b = new CloudBookStore('alice', api, sessionStorage)
  await b.sync()
  const book = structuredClone(a.draft!.book)
  book.accounts[0].opening = 99
  a.storage.write(JSON.stringify(book))
  await a.sync()
  await b.sync()
  expect(b.draft!.book.accounts[0].opening).toBe(99)
  expect(localStorage.getItem('my-finance-book.v3')).toBe('original')
  expect(new CloudBookStore('bob', api).draft).toBeNull()
})
test('lost acknowledgement retries the same operation without duplicating and survives reload', async () => {
  const api = server()
  const push = api.push
  let lose = true
  api.push = async (d) => {
    const row = await push(d)
    if (lose) {
      lose = false
      throw new Error('offline')
    }
    return row
  }
  const a = new CloudBookStore('alice', api)
  await a.create(emptyBook())
  expect(a.draft!.dirty).toBe(true)
  const restored = new CloudBookStore('alice', api)
  await restored.sync()
  expect(restored.draft!.revision).toBe(1)
  expect(restored.draft!.dirty).toBe(false)
})
test('stale device cannot overwrite another device; pending changes remain exportable', async () => {
  sessionStorage.clear()
  const api = server()
  const a = new CloudBookStore('alice', api)
  await a.create(emptyBook())
  const b = new CloudBookStore('alice', api, sessionStorage)
  await b.sync()
  const first = structuredClone(a.draft!.book)
  first.accounts[0].opening = 100
  a.storage.write(JSON.stringify(first))
  await a.sync()
  const stale = structuredClone(b.draft!.book)
  stale.accounts[0].opening = 200
  b.storage.write(JSON.stringify(stale))
  await b.sync()
  expect(b.conflict).toBe(true)
  expect(b.draft!.book.accounts[0].opening).toBe(200)
  expect(b.draft!.dirty).toBe(true)
  expect((await api.pull())!.book.accounts[0].opening).toBe(100)
  expect(() => b.storage.write(JSON.stringify(first))).toThrow()
  await b.useCloud()
  expect(b.draft!.book.accounts[0].opening).toBe(100)
})
