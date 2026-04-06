import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/handlers'
import ProfileTab from '../components/ProfileTab'

function renderProfileTab() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ProfileTab />
      </QueryClientProvider>
    </MemoryRouter>
  )
}

describe('ProfileTab', () => {
  it('renders username input with value from GET /users/me', async () => {
    renderProfileTab()
    const input = await screen.findByDisplayValue('testuser')
    expect(input).toBeTruthy()
  })

  it('fires PATCH /users/me/profile when Save changes is clicked', async () => {
    let patchFired = false
    server.use(
      http.patch('http://localhost:8000/users/me/profile', () => {
        patchFired = true
        return HttpResponse.json({
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
          bio: null,
          avatar_path: null,
        })
      })
    )

    renderProfileTab()
    await screen.findByDisplayValue('testuser')
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() => expect(patchFired).toBe(true))
  })

  it('"Change photo" button is present in the DOM', async () => {
    renderProfileTab()
    await screen.findByDisplayValue('testuser')
    expect(screen.getByRole('button', { name: /change photo/i })).toBeTruthy()
  })
})
