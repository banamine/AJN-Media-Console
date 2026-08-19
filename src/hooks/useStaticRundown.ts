import { useState, useEffect } from 'react';

export function useStaticRundown() {
  const [rundown, setRundown] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Dummy implementation to satisfy the player page component
    setTimeout(() => {
      setRundown([
        { network: 'AJN Live 24/7' }
      ]);
      setLoading(false);
    }, 500);
  }, []);

  return { rundown, loading };
}
