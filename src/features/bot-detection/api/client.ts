import axios from 'axios'
import { botDetectionApiBaseUrl } from '@/config/bot-detection'

export const botDetectionClient = axios.create({
  baseURL: botDetectionApiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
})
