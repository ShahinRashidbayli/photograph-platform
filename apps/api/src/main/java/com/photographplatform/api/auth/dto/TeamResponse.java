package com.photographplatform.api.auth.dto;

import java.util.List;

/**
 * Everything the team screen renders in one response.
 *
 * <p>{@code seatsUsed} counts colleagues *and* live invitations, matching what
 * the server enforces when a new one is issued. Returning only the headcount
 * would let the screen show "2 of 3" while the next invitation is refused.
 *
 * @param canManage whether the caller may invite and remove — false for
 *                  members, so the UI hides the controls the API would refuse
 */
public record TeamResponse(
    List<TeamMemberResponse> members,
    List<TeamInvitationResponse> invitations,
    long seatsUsed,
    int seatsTotal,
    boolean canManage
) {
}
