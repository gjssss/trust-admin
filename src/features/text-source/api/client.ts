import axios from 'axios'

export const textSourceClient = axios.create({
  baseURL: '/api/aigt',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
})
