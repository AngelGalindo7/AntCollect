import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import LibraryPage from '../pages/LibraryPage'

function renderLibraryPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <LibraryPage />
      </QueryClientProvider>
    </MemoryRouter>
  )
}

describe('LibraryPage', () => {
  it('renders title and add button', () => {
    renderLibraryPage()
    expect(screen.getByText('Anteater')).toBeTruthy()
    expect(screen.getByRole('button', { name: /new sticker/i })).toBeTruthy()
  })

  it('displays stickers from the API', async () => {
    renderLibraryPage()
    await waitFor(() => {
      expect(screen.getByText('Blue Petr')).toBeTruthy()
      expect(screen.getByText('Red Petr')).toBeTruthy()
    })
  })

  it('opens add sticker modal when clicking the button', async () => {
    renderLibraryPage()
    const addButton = screen.getByRole('button', { name: /new sticker/i })
    fireEvent.click(addButton)
    
    expect(screen.getByText('Add New Sticker')).toBeTruthy()
  })

  it('opens detail modal when clicking a sticker', async () => {
    renderLibraryPage()
    const sticker = await screen.findByText('Blue Petr')
    fireEvent.click(sticker)
    
    // The modal should show the title in a heading
    await waitFor(() => {
        const headings = screen.getAllByText('Blue Petr')
        // One in the grid, one in the modal
        expect(headings.length).toBeGreaterThan(1)
    })
  })
})
