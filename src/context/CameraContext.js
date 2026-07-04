import React, { createContext, useContext, useState } from 'react';

const CameraContext = createContext();

export function CameraProvider({ children }) {
  const [triggerCapture, setTriggerCapture] = useState(0);
  
  const capture = () => setTriggerCapture(prev => prev + 1);

  return (
    <CameraContext.Provider value={{ triggerCapture, capture }}>
      {children}
    </CameraContext.Provider>
  );
}

export const useCameraContext = () => useContext(CameraContext);
