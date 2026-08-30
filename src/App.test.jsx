import { render, screen, fireEvent, within } from '@testing-library/react'
import { vi } from 'vitest'
import React from 'react'
import App from './App'

const STORAGE_KEY = 'dapai-score-state-v1'

describe('App', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders title, default players and primary actions', () => {
    render(<App />)

    expect(screen.getByText('打牌记分器')).toBeInTheDocument()
    expect(screen.getByLabelText('玩家名称 1')).toHaveValue('玩家 A')
    expect(screen.getByLabelText('玩家名称 2')).toHaveValue('玩家 B')
    expect(screen.getByRole('button', { name: '添加本局' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '自动平衡' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '导出当前 CSV' })).toBeInTheDocument()
  })

  it('persists and reloads rounds from localStorage', () => {
    const state = {
      players: ['玩家 A', '玩家 B', '玩家 C', '玩家 D'],
      rounds: [
        { id: 1, scores: [10, -5, -3, -2], note: '' },
        { id: 2, scores: [-4, 4, 0, 0], note: '' },
      ],
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

    render(<App />)

    expect(screen.getByRole('row', { name: /第 1 局/ })).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /第 2 局/ })).toBeInTheDocument()
    expect(screen.getByLabelText('玩家 A 总分 6')).toBeInTheDocument()
  })

  it('renders cross-session overview when multiple sessions exist', () => {
    const sessions = [
      {
        id: 1,
        name: '会话 1',
        players: ['玩家 A', '玩家 B'],
        rounds: [{ id: 1, scores: [5, -5] }],
        nextRoundId: 2,
        targetRounds: '',
        createdAt: Date.now() - 1000,
      },
      {
        id: 2,
        name: '会话 2',
        players: ['玩家 A', '玩家 B'],
        rounds: [{ id: 1, scores: [-3, 3] }],
        nextRoundId: 2,
        targetRounds: '',
        createdAt: Date.now(),
      },
    ]
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessions, currentSessionId: 1 }))

    render(<App />)

    expect(screen.getAllByText('跨会话总览').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('会话 2').length).toBeGreaterThanOrEqual(1)
  })

  it('switching to doudizhu mode fixes the player count to 3', () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {})
    render(<App />)

    fireEvent.change(screen.getByDisplayValue('积分模式'), { target: { value: 'doudizhu' } })

    expect(screen.getByLabelText('玩家名称 1')).toHaveValue('玩家 A')
    expect(screen.getByLabelText('玩家名称 3')).toHaveValue('玩家 C')
    expect(screen.queryByLabelText('玩家名称 4')).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('斗地主模式')).toBeInTheDocument()
    vi.restoreAllMocks()
  })

  it('new session inherits players from the current session', () => {
    render(<App />)

    fireEvent.change(screen.getByLabelText('玩家名称 1'), { target: { value: '张三' } })
    fireEvent.click(screen.getByRole('button', { name: '新建' }))

    expect(screen.getByLabelText('玩家名称 1')).toHaveValue('张三')
    expect(screen.getByLabelText('玩家名称 2')).toHaveValue('玩家 B')
  })

  it('cross-session overview only lists players present in selected sessions', () => {
    const now = Date.now()
    const sessions = [
      {
        id: 1,
        name: '会话 1',
        players: ['玩家 A', '玩家 B', '玩家 C'],
        rounds: [{ id: 1, scores: [5, -2, -3], timestamp: now - 2000 }],
        nextRoundId: 2,
        targetRounds: '',
        scoringMode: 'standard',
        createdAt: now - 2000,
      },
      {
        id: 2,
        name: '会话 2',
        players: ['玩家 A', '玩家 D'],
        rounds: [{ id: 1, scores: [-4, 4], timestamp: now - 1000 }],
        nextRoundId: 2,
        targetRounds: '',
        scoringMode: 'standard',
        createdAt: now - 1000,
      },
    ]
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessions, currentSessionId: 1 }))

    render(<App />)

    const overview = document.getElementById('cross-overview')
    expect(overview).not.toBeNull()
    expect(within(overview).getAllByText('玩家 D').length).toBeGreaterThan(0)

    fireEvent.change(screen.getByDisplayValue('全部会话'), { target: { value: 'custom' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /会话 1/ }))

    expect(within(overview).getAllByText('玩家 B').length).toBeGreaterThan(0)
    expect(within(overview).queryByText('玩家 D')).not.toBeInTheDocument()
  })

  it('cross-session table shows 0 for participants and dash for non-participants', () => {
    const now = Date.now()
    const sessions = [
      {
        id: 1,
        name: '会话 1',
        players: ['玩家 A', '玩家 B', '玩家 C'],
        rounds: [{ id: 1, scores: [1, -1, 0], timestamp: now - 2000 }],
        nextRoundId: 2,
        targetRounds: '',
        scoringMode: 'standard',
        createdAt: now - 2000,
      },
      {
        id: 2,
        name: '会话 2',
        players: ['玩家 A', '玩家 D'],
        rounds: [{ id: 1, scores: [-2, 2], timestamp: now - 1000 }],
        nextRoundId: 2,
        targetRounds: '',
        scoringMode: 'standard',
        createdAt: now - 1000,
      },
    ]
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessions, currentSessionId: 1 }))

    render(<App />)

    const overview = document.getElementById('cross-overview')
    // 玩家 C 参与了会话 1 且净值为 0 → 表格中显示 0（而非 —）
    expect(within(overview).getAllByText('0').length).toBeGreaterThanOrEqual(1)
    // 未参与某会话的玩家（如会话 2 中的 B、C）显示 —，且合计行创建时间列也为 —
    expect(within(overview).getAllByText('—').length).toBeGreaterThanOrEqual(1)
  })
})
