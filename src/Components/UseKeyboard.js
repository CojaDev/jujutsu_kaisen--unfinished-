import { useEffect, useRef } from 'react';

export default function useKeyboard() {
  const inputMap = useRef({});

  useEffect(() => {
    const onDocumentInput = (e) => {
      if (e.type === 'keydown' || e.type === 'keyup') {
        inputMap.current[e.code] = e.type === 'keydown';
      } else if (e.type === 'mousedown' || e.type === 'mouseup') {
        // Map mouse clicks to corresponding keyboard-like codes
        inputMap.current[`Mouse${e.button}`] = e.type === 'mousedown';
      }
    };

    document.addEventListener('keydown', onDocumentInput);
    document.addEventListener('keyup', onDocumentInput);
    document.addEventListener('mousedown', onDocumentInput);
    document.addEventListener('mouseup', onDocumentInput);

    return () => {
      document.removeEventListener('keydown', onDocumentInput);
      document.removeEventListener('keyup', onDocumentInput);
      document.removeEventListener('mousedown', onDocumentInput);
      document.removeEventListener('mouseup', onDocumentInput);
    };
  }, []);

  return inputMap.current;
}
