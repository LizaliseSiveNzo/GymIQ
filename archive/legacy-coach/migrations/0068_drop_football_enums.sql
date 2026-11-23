-- Copyright © 2026 Lizalise Nzo. All rights reserved.
-- GymIQ — proprietary and confidential. See LICENSE.

-- 0068: Drop football enum types left unused after their tables were removed.
-- user_role is kept (users.role, current_role_of, handle_new_user still use it).

drop type if exists division_level;
drop type if exists rank_level;
drop type if exists trial_outcome;
drop type if exists rsvp_status;
