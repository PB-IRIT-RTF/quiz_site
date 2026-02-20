const LS_PARTICIPANT_ID = "uirit.participant_id";

export function getParticipantId() {
  return localStorage.getItem(LS_PARTICIPANT_ID);
}

export function isRegistered() {
  return Boolean(getParticipantId());
}
