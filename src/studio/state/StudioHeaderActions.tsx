import React from "react";

export type StudioHeaderPublishAction = {
  label: string;
  title?: string;
  disabled?: boolean;
  onClick: () => void;
};

export type StudioHeaderActions = {
  publish: StudioHeaderPublishAction | null;
};

type StudioHeaderActionsContextValue = {
  actions: StudioHeaderActions;
  setActions: (next: StudioHeaderActions) => void;
};

const StudioHeaderActionsContext = React.createContext<StudioHeaderActionsContextValue | null>(null);

export function StudioHeaderActionsProvider(props: { children: React.ReactNode }) {
  const [actions, setActionsState] = React.useState<StudioHeaderActions>({ publish: null });
  const setActions = React.useCallback((next: StudioHeaderActions) => setActionsState(next), []);
  return <StudioHeaderActionsContext.Provider value={{ actions, setActions }}>{props.children}</StudioHeaderActionsContext.Provider>;
}

export function useStudioHeaderActions(): StudioHeaderActionsContextValue {
  const ctx = React.useContext(StudioHeaderActionsContext);
  if (!ctx) throw new Error("useStudioHeaderActions must be used within StudioHeaderActionsProvider");
  return ctx;
}

export function useRegisterStudioHeaderActions(next: StudioHeaderActions) {
  const { setActions } = useStudioHeaderActions();
  React.useLayoutEffect(() => {
    setActions(next);
    return () => setActions({ publish: null });
  }, [next, setActions]);
}
