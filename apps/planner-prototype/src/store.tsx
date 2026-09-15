import {
  createContext,
  use,
  useEffect,
  useReducer,
  useState,
  type Dispatch,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ActivityIndicator, View } from "react-native";
import {
  initialState,
  reducer,
  restoreState,
  type Action,
  type State,
} from "./model";
const key = "wardrobe-native-design-week-v2";
const Context = createContext<{
  state: State;
  dispatch: Dispatch<Action>;
} | null>(null);
function LoadedStore({
  initial,
  children,
}: {
  initial: State;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, initial);
  useEffect(() => {
    void AsyncStorage.setItem(key, JSON.stringify(state));
  }, [state]);
  return <Context value={{ state, dispatch }}>{children}</Context>;
}
export function Store({ children }: { children: ReactNode }) {
  const [initial, setInitial] = useState<State | null>(null);
  useEffect(() => {
    void AsyncStorage.getItem(key)
      .then((raw) => setInitial(restoreState(raw)))
      .catch(() => setInitial(initialState()));
  }, []);
  if (!initial)
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  return <LoadedStore initial={initial}>{children}</LoadedStore>;
}
export function usePlanner() {
  const value = use(Context);
  if (!value) throw Error("Missing planner store");
  return value;
}
