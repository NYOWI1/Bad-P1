import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback
} from 'react';
import { api, hasToken, setToken } from '../services/api';
const Context = createContext(null);
export const useApp = () => useContext(Context);
export function AppProvider({ children }) {
  const [user, setUser] = useState(null),
    [config, setConfig] = useState(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [toast, setToast] = useState(null),
    [revision, setRevision] = useState(0);
  const notify = useCallback(
    (message, type = 'success') => setToast({ message, type }),
    []
  );
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  useEffect(() => {
    (async () => {
      try {
        const settings = await api('/config');
        setConfig(settings);
        if (hasToken()) {
          try {
            setUser(await api('/users/me'));
          } catch {
            setToken(null);
          }
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setReady(true);
      }
    })();
  }, []);
  const logout = () => {
    setToken(null);
    setUser(null);
    setRevision((r) => r + 1);
  };
  return (
    <Context.Provider
      value={{
        user,
        setUser,
        config,
        ready,
        error,
        logout,
        notify,
        toast,
        setToast,
        revision,
        refresh: () => setRevision((r) => r + 1)
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useResource(path) {
  const { revision } = useApp();
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  useEffect(() => {
    if (!path) {
      setState({ data: null, loading: false, error: '' });
      return;
    }
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: '' }));
    api(path)
      .then((data) => {
        if (alive) setState({ data, loading: false, error: '' });
      })
      .catch((e) => {
        if (alive) setState({ data: null, loading: false, error: e.message });
      });
    return () => {
      alive = false;
    };
  }, [path, revision]);
  return state;
}
