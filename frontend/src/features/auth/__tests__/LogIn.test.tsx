import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/handlers'
import LogIn from '../pages/LogIn'

function renderLogIn() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <LogIn />
      </QueryClientProvider>
    </MemoryRouter>
  )
}

describe('LogIn', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders email input, password input, and submit button', () => {
    const { container } = renderLogIn()
    expect(container.querySelector('input[type="text"]')).toBeTruthy()
    expect(container.querySelector('input[type="password"]')).toBeTruthy()
    expect(screen.getByRole('button', { name: /create account/i })).toBeTruthy()
  })

  it('sets localStorage.username after successful POST /users/login', async () => {
    const { container } = renderLogIn()

    fireEvent.change(container.querySelector('input[type="text"]')!, {
      target: { value: 'test@example.com' },
    })
    fireEvent.change(container.querySelector('input[type="password"]')!, {
      target: { value: 'secret123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => expect(localStorage.getItem('username')).toBe('testuser'))
  })

  it('shows error text when POST /users/login returns 401', async () => {
    server.use(
      http.post('http://localhost:8000/users/login', () => {
        return HttpResponse.json({ detail: 'Invalid credentials' }, { status: 401 })
      })
    )

    const { container } = renderLogIn()

    fireEvent.change(container.querySelector('input[type="text"]')!, {
      target: { value: 'wrong@example.com' },
    })
    fireEvent.change(container.querySelector('input[type="password"]')!, {
      target: { value: 'wrongpass' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() =>
      expect(screen.getByText('Invalid credentials')).toBeTruthy()
    )
  })
})
