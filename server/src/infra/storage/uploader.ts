import type { Readable } from 'node:stream'

export type UploadInput = {
  key: string
  contentType: string
  contentDisposition: string
  body: Readable
}

export type UploadResult = {
  key: string
  url: string
}

export interface Uploader {
  upload(input: UploadInput): Promise<UploadResult>
}
