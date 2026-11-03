export const fakeNewsBaseUrl = '/api/fake-news'

export const fakeNewsApiBaseUrl = fakeNewsBaseUrl

export function getFakeNewsImageUrl(imagePath: string) {
  return `${fakeNewsApiBaseUrl}/image/${encodeURIComponent(imagePath)}`
}
