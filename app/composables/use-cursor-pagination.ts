import { useAsyncState, watchDebounced } from '@vueuse/core'

interface CursorPaginationOptions<T> {
  pageSize: number
  fetchFn: (opts: { cursor: string | undefined; limit: number; search: string | undefined }) => Promise<{ items: T[]; nextCursor?: string }>
  initialItems?: T[]
  searchDebounce?: number
}

export function useCursorPagination<T>(options: CursorPaginationOptions<T>) {
  const {
    pageSize,
    fetchFn,
    initialItems = [] as T[],
    searchDebounce = 300,
  } = options

  const currentCursor = ref<string | undefined>(undefined)
  const nextCursor = ref<string | undefined>(undefined)
  const pageCursors = ref<(string | undefined)[]>([undefined])
  const pageIndex = ref(0)
  const search = ref('')

  const { state: items, isLoading: loading, error, execute: fetchPage } = useAsyncState(
    async () => {
      const searchValue = search.value.trim() || undefined
      const result = await fetchFn({
        cursor: searchValue ? undefined : currentCursor.value,
        limit: pageSize,
        search: searchValue,
      })
      nextCursor.value = result.nextCursor
      return result.items
    },
    initialItems,
    { shallow: false },
  )

  const isSearchActive = computed(() => search.value.trim().length > 0)

  watchDebounced(search, () => {
    currentCursor.value = undefined
    pageIndex.value = 0
    pageCursors.value = [undefined]
    fetchPage()
  }, { debounce: searchDebounce })

  const hasMore = computed(() => !isSearchActive.value && nextCursor.value !== undefined)
  const hasPrev = computed(() => !isSearchActive.value && pageIndex.value > 0)

  async function goNext() {
    if (!nextCursor.value) return
    pageCursors.value.push(nextCursor.value)
    pageIndex.value++
    currentCursor.value = nextCursor.value
    await fetchPage()
  }

  async function goPrev() {
    if (pageIndex.value === 0) return
    pageIndex.value--
    currentCursor.value = pageCursors.value[pageIndex.value]
    await fetchPage()
  }

  function refresh() {
    search.value = ''
    currentCursor.value = undefined
    pageIndex.value = 0
    pageCursors.value = [undefined]
    fetchPage()
  }

  return {
    items,
    loading: readonly(loading),
    error: readonly(error),
    pageIndex: readonly(pageIndex),
    isSearchActive: readonly(isSearchActive) as Readonly<Ref<boolean>>,
    search,
    hasMore: readonly(hasMore) as Readonly<Ref<boolean>>,
    hasPrev: readonly(hasPrev) as Readonly<Ref<boolean>>,
    goNext,
    goPrev,
    refresh,
    fetchPage,
  }
}

export type CursorPaginationReturn<T> = ReturnType<typeof useCursorPagination<T>>
