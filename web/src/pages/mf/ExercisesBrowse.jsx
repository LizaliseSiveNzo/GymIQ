/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import TabShell from '../../shell/TabShell.jsx';
import ExercisePicker from '../../components/ui/ExercisePicker.jsx';

// Phase 1: browse the exercise catalog, filterable against a real equipment set.
export default function ExercisesBrowse() {
  return (
    <TabShell active="workout" title="Exercises">
      <ExercisePicker mode="browse" />
    </TabShell>
  );
}
