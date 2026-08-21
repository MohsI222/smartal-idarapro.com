import { useEffect } from 'react';

interface InventoryModuleWithShiftsProps {
  draftLines: any[];
}

export function InventoryModuleWithShifts({ draftLines }: InventoryModuleWithShiftsProps) {
  // Track when draft lines are cleared (sale completed)
  useEffect(() => {
    if (draftLines.length === 0) return;
  }, [draftLines]);

  return null;
}
