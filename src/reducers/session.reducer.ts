import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface SessionState {
  personas: any[]; // Replace with actual Persona type when available
  scenarioData: any[]; // Replace with actual structure
  selectedPersonaId: string | null;
  selectedScenarioId: string | null;
  // Add other session-related state as needed
}

const initialState: SessionState = {
  personas: [],
  scenarioData: [],
  selectedPersonaId: null,
  selectedScenarioId: null,
};

export const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    setPersonas: (state, action: PayloadAction<any[]>) => {
      state.personas = action.payload;
    },
    setScenarioData: (state, action: PayloadAction<any[]>) => {
      state.scenarioData = action.payload;
    },
    selectPersona: (state, action: PayloadAction<string>) => {
      state.selectedPersonaId = action.payload;
    },
    selectScenario: (state, action: PayloadAction<string>) => {
      state.selectedScenarioId = action.payload;
    },
    clearSelection: (state) => {
      state.selectedPersonaId = null;
      state.selectedScenarioId = null;
    },
  },
});

export const { setPersonas, setScenarioData, selectPersona, selectScenario, clearSelection } = sessionSlice.actions;

export default sessionSlice.reducer;