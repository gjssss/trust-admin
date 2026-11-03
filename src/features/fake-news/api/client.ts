import axios from 'axios'
import { fakeNewsApiBaseUrl } from '@/config/fake-news'

export const fakeNewsClient = axios.create({
  baseURL: fakeNewsApiBaseUrl,
})
