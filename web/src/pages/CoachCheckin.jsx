/*
 * Copyright © 2026 Lizalise Nzo & Dumabezwe Skele. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

// The old standalone check-in screen duplicated the Training page.
// All links to /coach/checkin now land on Training with the session preselected.
export default function CoachCheckin() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  useEffect(() => {
    const sid = params.get('session');
    navigate(sid ? `/coach/training?session=${sid}` : '/coach/training', { replace: true });
  }, []);
  return null;
}
