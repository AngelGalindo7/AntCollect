import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

export const handlers = [
  http.get('http://localhost:8000/users/me', () => {
    return HttpResponse.json({
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      bio: null,
      avatar_path: null,
    })
  }),
  http.patch('http://localhost:8000/users/me/profile', () => {
    return HttpResponse.json({
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      bio: null,
      avatar_path: null,
    })
  }),
  http.post('http://localhost:8000/users/me/avatar', () => {
    return HttpResponse.json({ avatar_path: 'Uploads/1/thumbnail/new.jpg' })
  }),
  http.post('http://localhost:8000/users/me/password', () => {
    return HttpResponse.json({})
  }),
  http.post('http://localhost:8000/users/login', () => {
    return HttpResponse.json({
      user: { id: 1, username: 'testuser', email: 'test@example.com' },
    })
  }),
]

export const server = setupServer(...handlers)
