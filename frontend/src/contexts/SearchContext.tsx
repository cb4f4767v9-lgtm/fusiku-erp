import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type SearchContextType = {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
};

const SearchContext = createContext<SearchContextType | null>(null);

export function SearchProvider({ children }: { children: ReactNode }) {
  const [searchQuery, setSearchQuery] = useState('');
  return (
    <SearchContext.Provider value={{ searchQuery, setSearchQuery }}>
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch() {
  const ctx = useContext(SearchContext);
  return ctx ?? { searchQuery: '', setSearchQuery: () => {} };
}
