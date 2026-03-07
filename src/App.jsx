import { useMemo, useRef, useState } from 'react'
import './App.css'

const GRID_SIZE = 9
const CELL_COUNT = GRID_SIZE * GRID_SIZE
const BOX_SIZE = 3

const CAGE_COLORS = [
  'rgba(124, 50, 53, 0.72)',
  'rgba(112, 102, 53, 0.72)',
  'rgba(44, 98, 102, 0.72)',
  'rgba(35, 97, 100, 0.72)',
  'rgba(60, 54, 114, 0.72)',
  'rgba(117, 53, 59, 0.72)',
  'rgba(59, 83, 118, 0.72)',
  'rgba(107, 84, 52, 0.72)',
  'rgba(23, 94, 96, 0.72)',
  'rgba(102, 53, 89, 0.72)',
  'rgba(73, 80, 95, 0.72)',
  'rgba(58, 94, 99, 0.72)',
  'rgba(87, 63, 56, 0.72)',
  'rgba(57, 54, 108, 0.72)',
  'rgba(80, 63, 115, 0.72)',
]

function coordToIndex(row, col) {
  return row * GRID_SIZE + col
}

function indexToCoord(index) {
  return {
    row: Math.floor(index / GRID_SIZE),
    col: index % GRID_SIZE,
  }
}

function boxIndex(row, col) {
  return Math.floor(row / BOX_SIZE) * BOX_SIZE + Math.floor(col / BOX_SIZE)
}

function digitMask(digit) {
  return 1 << digit
}

function maskToDigits(mask) {
  const digits = []
  for (let digit = 1; digit <= 9; digit += 1) {
    if ((mask & digitMask(digit)) === 0) {
      digits.push(digit)
    }
  }
  return digits
}

function parseCageCells(input) {
  const normalized = input.replace(/\s+/g, '').toLowerCase()
  const matches = [...normalized.matchAll(/([1-9]),([1-9])/g)]

  if (matches.length === 0) {
    throw new Error('Informe as celulas no formato 1,1+1,2.')
  }

  const indexes = []
  const unique = new Set()

  for (const match of matches) {
    const row = Number(match[1]) - 1
    const col = Number(match[2]) - 1
    const index = coordToIndex(row, col)

    if (unique.has(index)) {
      throw new Error('Uma celula foi repetida no mesmo cage.')
    }

    unique.add(index)
    indexes.push(index)
  }

  return indexes
}

function parseInput(cellsText, sumText) {
  const raw = cellsText.trim()
  const hasInlineSum = raw.includes('=')

  let cellsPart = raw
  let sumPart = sumText.trim()

  if (hasInlineSum) {
    const [left, right] = raw.split('=')
    cellsPart = (left || '').trim()
    if (!sumPart) {
      sumPart = (right || '').trim()
    }
  }

  const sum = Number(sumPart)
  if (!Number.isInteger(sum) || sum <= 0) {
    throw new Error('A soma precisa ser um numero inteiro positivo.')
  }

  const cells = parseCageCells(cellsPart)
  return { cells, sum }
}

function minPossibleSum(availableDigits, count) {
  let total = 0
  for (let i = 0; i < count; i += 1) {
    total += availableDigits[i]
  }
  return total
}

function maxPossibleSum(availableDigits, count) {
  let total = 0
  for (let i = 0; i < count; i += 1) {
    total += availableDigits[availableDigits.length - 1 - i]
  }
  return total
}

function validateBeforeSolve(cages) {
  const owner = Array(CELL_COUNT).fill(-1)

  cages.forEach((cage, cageIndex) => {
    const size = cage.cells.length
    const min = (size * (size + 1)) / 2
    const max = (size * (19 - size)) / 2

    if (cage.sum < min || cage.sum > max) {
      throw new Error(
        `Cage ${cageIndex + 1} impossivel: soma ${cage.sum} nao combina com ${size} celula(s).`,
      )
    }

    cage.cells.forEach((cell) => {
      if (owner[cell] !== -1) {
        throw new Error('Existem celulas sobrepostas entre cages.')
      }
      owner[cell] = cageIndex
    })
  })

  if (owner.some((value) => value === -1)) {
    throw new Error('Preencha todos os 81 quadrados com cages antes de resolver.')
  }

  return owner
}

function solveKillerSudoku(cages, initialValues) {
  const cellToCage = validateBeforeSolve(cages)
  const values = Array(CELL_COUNT).fill(0)
  const rows = Array(GRID_SIZE).fill(0)
  const cols = Array(GRID_SIZE).fill(0)
  const boxes = Array(GRID_SIZE).fill(0)

  const cageStates = cages.map((cage) => ({
    target: cage.sum,
    size: cage.cells.length,
    sum: 0,
    usedMask: 0,
    filled: 0,
  }))

  let givenCount = 0

  for (let cell = 0; cell < CELL_COUNT; cell += 1) {
    const digit = initialValues[cell] || 0
    if (digit === 0) {
      continue
    }

    const { row, col } = indexToCoord(cell)
    const box = boxIndex(row, col)
    const bit = digitMask(digit)
    const cageState = cageStates[cellToCage[cell]]

    if ((rows[row] & bit) !== 0) {
      throw new Error(`Conflito nas pistas: o numero ${digit} repete na linha ${row + 1}.`)
    }
    if ((cols[col] & bit) !== 0) {
      throw new Error(`Conflito nas pistas: o numero ${digit} repete na coluna ${col + 1}.`)
    }
    if ((boxes[box] & bit) !== 0) {
      throw new Error('Conflito nas pistas: o numero repete no bloco 3x3.')
    }
    if ((cageState.usedMask & bit) !== 0) {
      throw new Error('Conflito nas pistas: numero repetido dentro de um mesmo cage.')
    }
    if (cageState.sum + digit > cageState.target) {
      throw new Error('Conflito nas pistas: a soma de um cage foi ultrapassada.')
    }

    values[cell] = digit
    rows[row] |= bit
    cols[col] |= bit
    boxes[box] |= bit
    cageState.sum += digit
    cageState.usedMask |= bit
    cageState.filled += 1
    givenCount += 1
  }

  for (const cageState of cageStates) {
    const remaining = cageState.size - cageState.filled
    if (remaining === 0) {
      if (cageState.sum !== cageState.target) {
        throw new Error('Conflito nas pistas: um cage completo nao bate com a soma.')
      }
      continue
    }

    const availableDigits = maskToDigits(cageState.usedMask)
    if (availableDigits.length < remaining) {
      throw new Error('Conflito nas pistas: cage sem digitos suficientes para completar.')
    }
    const min = minPossibleSum(availableDigits, remaining)
    const max = maxPossibleSum(availableDigits, remaining)
    if (cageState.sum + min > cageState.target || cageState.sum + max < cageState.target) {
      throw new Error('Conflito nas pistas: cage nao pode atingir a soma informada.')
    }
  }

  function canPlaceInCage(cageState, digit) {
    const bit = digitMask(digit)
    if ((cageState.usedMask & bit) !== 0) {
      return false
    }

    const newSum = cageState.sum + digit
    const remaining = cageState.size - cageState.filled - 1

    if (newSum > cageState.target) {
      return false
    }

    if (remaining === 0) {
      return newSum === cageState.target
    }

    const newMask = cageState.usedMask | bit
    const availableDigits = maskToDigits(newMask)

    if (availableDigits.length < remaining) {
      return false
    }

    const min = minPossibleSum(availableDigits, remaining)
    const max = maxPossibleSum(availableDigits, remaining)

    return newSum + min <= cageState.target && newSum + max >= cageState.target
  }

  function candidatesForCell(cellIndex) {
    const { row, col } = indexToCoord(cellIndex)
    const usedMask = rows[row] | cols[col] | boxes[boxIndex(row, col)]
    const cageState = cageStates[cellToCage[cellIndex]]
    const candidates = []

    for (let digit = 1; digit <= 9; digit += 1) {
      const bit = digitMask(digit)
      if ((usedMask & bit) !== 0) {
        continue
      }
      if (!canPlaceInCage(cageState, digit)) {
        continue
      }
      candidates.push(digit)
    }

    return candidates
  }

  function pickNextCell() {
    let bestCell = -1
    let bestCandidates = null

    for (let i = 0; i < CELL_COUNT; i += 1) {
      if (values[i] !== 0) {
        continue
      }

      const candidates = candidatesForCell(i)

      if (candidates.length === 0) {
        return { cell: i, candidates }
      }

      if (!bestCandidates || candidates.length < bestCandidates.length) {
        bestCell = i
        bestCandidates = candidates
      }

      if (bestCandidates.length === 1) {
        break
      }
    }

    return { cell: bestCell, candidates: bestCandidates }
  }

  function search(filledCount) {
    if (filledCount === CELL_COUNT) {
      return true
    }

    const { cell, candidates } = pickNextCell()
    if (cell === -1 || !candidates || candidates.length === 0) {
      return false
    }

    const { row, col } = indexToCoord(cell)
    const box = boxIndex(row, col)
    const cageIndex = cellToCage[cell]
    const cageState = cageStates[cageIndex]

    for (const digit of candidates) {
      const bit = digitMask(digit)

      values[cell] = digit
      rows[row] |= bit
      cols[col] |= bit
      boxes[box] |= bit
      cageState.sum += digit
      cageState.usedMask |= bit
      cageState.filled += 1

      if (search(filledCount + 1)) {
        return true
      }

      values[cell] = 0
      rows[row] &= ~bit
      cols[col] &= ~bit
      boxes[box] &= ~bit
      cageState.sum -= digit
      cageState.usedMask &= ~bit
      cageState.filled -= 1
    }

    return false
  }

  return search(givenCount) ? values : null
}

function App() {
  const [cellsInput, setCellsInput] = useState('')
  const [sumInput, setSumInput] = useState('')
  const [cages, setCages] = useState([])
  const [editingCageId, setEditingCageId] = useState(null)
  const [givenValues, setGivenValues] = useState(Array(CELL_COUNT).fill(0))
  const [solution, setSolution] = useState(null)
  const [message, setMessage] = useState('')
  const cellsInputRef = useRef(null)
  const sumInputRef = useRef(null)

  const cageByCell = useMemo(() => {
    const map = Array(CELL_COUNT).fill(null)
    cages.forEach((cage, cageIndex) => {
      cage.cells.forEach((cell) => {
        map[cell] = cageIndex
      })
    })
    return map
  }, [cages])

  const cageFirstCell = useMemo(() => {
    const map = new Map()
    cages.forEach((cage, cageIndex) => {
      map.set(cageIndex, cage.cells[0])
    })
    return map
  }, [cages])

  const occupiedCount = useMemo(
    () => cageByCell.reduce((total, cage) => (cage === null ? total : total + 1), 0),
    [cageByCell],
  )
  const hasGivenValues = useMemo(
    () => givenValues.some((value) => value !== 0),
    [givenValues],
  )
  const boardMode = solution
    ? 'solved'
    : cages.length > 0 || hasGivenValues
      ? 'filled'
      : 'empty'

  function addCage() {
    try {
      const parsed = parseInput(cellsInput, sumInput)
      const editingIndex = cages.findIndex((cage) => cage.id === editingCageId)
      const overlap = parsed.cells.find((cell) => {
        const owner = cageByCell[cell]
        if (owner === null) {
          return false
        }
        if (editingIndex !== -1 && owner === editingIndex) {
          return false
        }
        return true
      })

      if (overlap !== undefined) {
        const { row, col } = indexToCoord(overlap)
        throw new Error(`A celula ${row + 1},${col + 1} ja pertence a outro cage.`)
      }

      setCages((current) => {
        if (!editingCageId) {
          return [
            ...current,
            {
              id: crypto.randomUUID(),
              sum: parsed.sum,
              cells: parsed.cells,
              color: CAGE_COLORS[current.length % CAGE_COLORS.length],
            },
          ]
        }

        return current.map((cage) =>
          cage.id === editingCageId
            ? {
                ...cage,
                sum: parsed.sum,
                cells: parsed.cells,
              }
            : cage,
        )
      })
      setCellsInput('')
      setSumInput('')
      setEditingCageId(null)
      setSolution(null)
      setMessage(editingCageId ? 'Cage atualizado.' : 'Cage adicionado.')
      cellsInputRef.current?.focus()
    } catch (error) {
      setMessage(error.message)
    }
  }

  function removeCage(id) {
    setCages((current) => current.filter((cage) => cage.id !== id))
    if (editingCageId === id) {
      setEditingCageId(null)
      setCellsInput('')
      setSumInput('')
    }
    setSolution(null)
    setMessage('Cage removido.')
  }

  function editCage(id) {
    const cage = cages.find((item) => item.id === id)
    if (!cage) {
      return
    }

    setEditingCageId(id)
    setCellsInput(
      cage.cells
        .map((cell) => {
          const { row, col } = indexToCoord(cell)
          return `${row + 1},${col + 1}`
        })
        .join('+'),
    )
    setSumInput(String(cage.sum))
    setMessage('Editando cage selecionado.')
    cellsInputRef.current?.focus()
  }

  function cancelEdit() {
    setEditingCageId(null)
    setCellsInput('')
    setSumInput('')
    setMessage('Edicao cancelada.')
    cellsInputRef.current?.focus()
  }

  function clearAll() {
    setCages([])
    setEditingCageId(null)
    setGivenValues(Array(CELL_COUNT).fill(0))
    setCellsInput('')
    setSumInput('')
    setSolution(null)
    setMessage('Tabuleiro limpo.')
  }

  function solve() {
    try {
      const solved = solveKillerSudoku(cages, givenValues)
      if (!solved) {
        setMessage('Nao foi encontrada solucao para os cages informados.')
        setSolution(null)
        return
      }

      setSolution(solved)
      setMessage('Sudoku resolvido com sucesso.')
    } catch (error) {
      setMessage(error.message)
      setSolution(null)
    }
  }

  function handleGivenChange(cellIndex, rawValue) {
    const cleaned = rawValue.replace(/\s+/g, '')
    const nextChar = cleaned.slice(-1)
    const nextValue = /^[1-9]$/.test(nextChar) ? Number(nextChar) : 0

    setGivenValues((current) => {
      const updated = [...current]
      updated[cellIndex] = nextValue
      return updated
    })
    setSolution(null)
    setMessage('')
  }

  function cellStyle(index) {
    const { row, col } = indexToCoord(index)
    const cageIndex = cageByCell[index]
    const currentCage = cageIndex === null ? null : cages[cageIndex]
    const top = row === 0 || cageByCell[coordToIndex(row - 1, col)] !== cageIndex
    const right =
      col === GRID_SIZE - 1 || cageByCell[coordToIndex(row, col + 1)] !== cageIndex
    const bottom =
      row === GRID_SIZE - 1 || cageByCell[coordToIndex(row + 1, col)] !== cageIndex
    const left = col === 0 || cageByCell[coordToIndex(row, col - 1)] !== cageIndex

    return {
      backgroundColor: currentCage ? currentCage.color : 'transparent',
      '--cage-top': top && currentCage ? '1px dashed #8b90a6' : '0px solid transparent',
      '--cage-right':
        right && currentCage ? '1px dashed #8b90a6' : '0px solid transparent',
      '--cage-bottom':
        bottom && currentCage ? '1px dashed #8b90a6' : '0px solid transparent',
      '--cage-left':
        left && currentCage ? '1px dashed #8b90a6' : '0px solid transparent',
    }
  }

  return (
    <main className="page">
      <section className="panel">
        <h1>Killer Sudoku Solver</h1>
        <p className="hint">
          Informe cada cage com celulas no formato <strong>1,1+1,2</strong> ou{' '}
          <strong>1,1+1,2=9</strong>. Voce tambem pode digitar pistas direto no tabuleiro.
        </p>

        <div className="form">
          <label>
            Celulas do cage
            <input
              ref={cellsInputRef}
              type="text"
              placeholder="1,1+2,1"
              value={cellsInput}
              onChange={(event) => setCellsInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Tab' && !event.shiftKey) {
                  event.preventDefault()
                  sumInputRef.current?.focus()
                }
              }}
            />
          </label>
          <label>
            Soma
            <input
              ref={sumInputRef}
              type="number"
              min="1"
              placeholder="9"
              value={sumInput}
              onChange={(event) => setSumInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addCage()
                }
              }}
            />
          </label>
          <div className="actions">
            <button type="button" onClick={addCage}>
              {editingCageId ? 'Salvar edicao' : 'Adicionar cage'}
            </button>
            {editingCageId && (
              <button type="button" className="ghost" onClick={cancelEdit}>
                Cancelar edicao
              </button>
            )}
            <button type="button" onClick={solve}>
              Resolver Sudoku
            </button>
            <button type="button" className="ghost" onClick={clearAll}>
              Limpar tudo
            </button>
          </div>
          <p className="status">{message || ' '}</p>
          <p className="progress">
            Celulas preenchidas por cages: {occupiedCount}/81
          </p>
        </div>

        <ul className="cage-list">
          {cages.map((cage, index) => (
            <li key={cage.id}>
              <span
                className="swatch"
                style={{
                  backgroundColor: cage.color,
                }}
              />
              <span>
                Cage {index + 1}: soma {cage.sum} -{' '}
                {cage.cells
                  .map((cell) => {
                    const { row, col } = indexToCoord(cell)
                    return `${row + 1},${col + 1}`
                  })
                  .join('+')}
              </span>
              <button type="button" className="remove" onClick={() => removeCage(cage.id)}>
                Remover
              </button>
              <button type="button" className="edit" onClick={() => editCage(cage.id)}>
                Editar
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className={`board-wrapper ${boardMode}`}>
        <div className={`board ${boardMode}`}>
          {Array.from({ length: CELL_COUNT }, (_, index) => {
            const cageIndex = cageByCell[index]
            const cage = cageIndex === null ? null : cages[cageIndex]
            const showSum = cage && cageFirstCell.get(cageIndex) === index
            return (
              <div key={index} className="cell" style={cellStyle(index)}>
                {showSum && <span className="sum-label">{cage.sum}</span>}
                {solution ? (
                  <span className="value">{solution[index]}</span>
                ) : (
                  <input
                    className="cell-input"
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={givenValues[index] || ''}
                    onChange={(event) => handleGivenChange(index, event.target.value)}
                    aria-label={`Celula ${index + 1}`}
                  />
                )}
              </div>
            )
          })}
        </div>
      </section>
    </main>
  )
}

export default App
