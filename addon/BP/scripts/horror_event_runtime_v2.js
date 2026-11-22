function conditionMatches(condition, context) {
  if (!condition) return true;
  switch (condition) {
    case 'turned_around': return !!context?.turnedAround;
    case 'not_turned': return !context?.turnedAround;
    case 'sprinting': return !!context?.sprinting;
    case 'not_sprinting': return !context?.sprinting;
    case 'still': return Number(context?.stillTicks || 0) >= 20;
    case 'moving': return Number(context?.speed || 0) > 0.04;
    case 'dark': return Number(context?.lightLevel ?? 15) <= 5;
    case 'backtracked': return !!context?.backtracked;
    default: return false;
  }
}

export function createHorrorEventRuntime(adapter = {}) {
  const sessions = new Map();

  function reportError(stage, session, action, error) {
    try {
      adapter.reportError?.({
        stage,
        sessionId: session?.id,
        playerId: session?.playerId,
        eventKey: session?.event?.key,
        actionType: action?.type,
        error,
      });
    } catch (_reportError) {}
  }

  function cleanup(session, reason) {
    if (!session || session.cleaned) return;
    session.cleaned = true;
    try { adapter.cleanupSession?.(session, reason); } catch (error) { reportError('cleanup', session, undefined, error); }
  }

  return {
    start(input) {
      if (!input?.id || !input?.event) return undefined;
      const session = {
        id: input.id,
        playerId: input.playerId,
        event: input.event,
        startTick: Number(input.startTick) || 0,
        nextActionIndex: 0,
        cleaned: false,
        data: input.data || {},
      };
      sessions.set(session.id, session);
      return session;
    },

    tick(now) {
      const currentTick = Number(now) || 0;
      for (const session of [...sessions.values()]) {
        const elapsed = Math.max(0, currentTick - session.startTick);
        const actions = session.event.actions || [];
        while (session.nextActionIndex < actions.length && actions[session.nextActionIndex].at <= elapsed) {
          const action = actions[session.nextActionIndex++];
          let context = {};
          try { context = adapter.getPlayerContext?.(session.playerId, session) || {}; } catch (error) { reportError('get_context', session, action, error); }
          if (!conditionMatches(action.condition, context)) continue;
          try { adapter.executeAction?.(session, action, currentTick, context); } catch (error) { reportError('execute_action', session, action, error); }
        }
        if (elapsed >= Number(session.event.durationTicks || 0)) {
          cleanup(session, 'complete');
          sessions.delete(session.id);
        }
      }
    },

    abort(sessionId, reason = 'abort') {
      const session = sessions.get(sessionId);
      if (!session) return false;
      cleanup(session, reason);
      sessions.delete(sessionId);
      return true;
    },

    abortPlayer(playerId, reason = 'player_abort') {
      let count = 0;
      for (const session of [...sessions.values()]) {
        if (session.playerId !== playerId) continue;
        if (this.abort(session.id, reason)) count += 1;
      }
      return count;
    },

    getSession(sessionId) { return sessions.get(sessionId); },
    getSessions() { return [...sessions.values()]; },
    activeCount() { return sessions.size; },
  };
}
