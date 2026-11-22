package com.railway.itsm.service.notify;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Who hears about which event, on which channel. Keeping the rules in one table means adding an
 * event or a channel does not touch the senders.
 */
public final class NotificationPolicy {
    /** HANDOVER_TARGET: the colleague an open hand-over waits for. PREVIOUS_ASSIGNEE: who last passed the incident on. */
    public enum Audience { REPORTER, ASSIGNEE, MANAGERS, HANDOVER_TARGET, PREVIOUS_ASSIGNEE }

    public enum Channel { IN_APP, EMAIL }

    private record Rule(Set<Audience> inApp, Set<Audience> email) {}

    private static final Set<Audience> NONE = Set.of();
    private static final Map<String, Rule> RULES = Map.ofEntries(
            Map.entry("CREATED", new Rule(Set.of(Audience.MANAGERS), Set.of(Audience.MANAGERS))),
            Map.entry("RECEIVED", new Rule(Set.of(Audience.REPORTER), NONE)),
            Map.entry("INCIDENT_EDITED", new Rule(Set.of(Audience.ASSIGNEE), NONE)),
            Map.entry("PRIORITY_CHANGED", new Rule(Set.of(Audience.ASSIGNEE, Audience.MANAGERS), Set.of(Audience.ASSIGNEE))),
            Map.entry("MESSAGE_FROM_REPORTER", new Rule(Set.of(Audience.ASSIGNEE), Set.of(Audience.ASSIGNEE))),
            Map.entry("MESSAGE_UNASSIGNED", new Rule(Set.of(Audience.MANAGERS), NONE)),
            Map.entry("MESSAGE_TO_REPORTER", new Rule(Set.of(Audience.REPORTER), Set.of(Audience.REPORTER))),
            Map.entry("ASSIGNED", new Rule(Set.of(Audience.REPORTER, Audience.ASSIGNEE), Set.of(Audience.ASSIGNEE))),
            Map.entry("ACKNOWLEDGED", new Rule(Set.of(Audience.REPORTER), NONE)),
            Map.entry("IN_PROGRESS", new Rule(Set.of(Audience.REPORTER), NONE)),
            Map.entry("RESOLVED", new Rule(Set.of(Audience.REPORTER, Audience.MANAGERS), Set.of(Audience.REPORTER))),
            Map.entry("VERIFIED", new Rule(Set.of(Audience.ASSIGNEE, Audience.MANAGERS), NONE)),
            Map.entry("CLOSED", new Rule(Set.of(Audience.REPORTER, Audience.ASSIGNEE), Set.of(Audience.REPORTER))),
            Map.entry("SLA_WARNING", new Rule(Set.of(Audience.ASSIGNEE, Audience.MANAGERS), NONE)),
            Map.entry("SLA_VIOLATED", new Rule(Set.of(Audience.ASSIGNEE, Audience.MANAGERS), Set.of(Audience.MANAGERS))),
            Map.entry("ESCALATED", new Rule(Set.of(Audience.MANAGERS), Set.of(Audience.MANAGERS))),
            Map.entry("INFO_REQUESTED", new Rule(Set.of(Audience.REPORTER), Set.of(Audience.REPORTER))),
            Map.entry("INFO_PROVIDED", new Rule(Set.of(Audience.ASSIGNEE), NONE)),
            // Technicians sharing work. Reporters only hear SPECIALIST_CHANGED, which names no one.
            Map.entry("HANDOVER_REQUESTED", new Rule(Set.of(Audience.HANDOVER_TARGET, Audience.MANAGERS), Set.of(Audience.HANDOVER_TARGET))),
            Map.entry("HANDOVER_WITHDRAWN", new Rule(Set.of(Audience.HANDOVER_TARGET), NONE)),
            Map.entry("HANDOVER_DECLINED", new Rule(Set.of(Audience.ASSIGNEE, Audience.MANAGERS), NONE)),
            Map.entry("HANDOVER_ACCEPTED", new Rule(Set.of(Audience.PREVIOUS_ASSIGNEE, Audience.MANAGERS), NONE)),
            Map.entry("HANDED_OFF", new Rule(Set.of(Audience.ASSIGNEE, Audience.MANAGERS), Set.of(Audience.ASSIGNEE))),
            Map.entry("HANDED_BACK", new Rule(Set.of(Audience.MANAGERS), Set.of(Audience.MANAGERS))),
            Map.entry("SPECIALIST_CHANGED", new Rule(Set.of(Audience.REPORTER), NONE)));

    public Set<Long> recipients(String eventType, Channel channel, Long reporterId, Long assigneeId, List<Long> managerIds) {
        return recipients(eventType, channel, reporterId, assigneeId, managerIds, null, null);
    }

    public Set<Long> recipients(String eventType, Channel channel, Long reporterId, Long assigneeId, List<Long> managerIds,
                                Long handoverTargetId, Long previousAssigneeId) {
        Rule rule = RULES.get(eventType);
        if (rule == null) return Set.of();
        Set<Long> ids = new LinkedHashSet<>();
        for (Audience a : channel == Channel.IN_APP ? rule.inApp() : rule.email()) {
            switch (a) {
                case REPORTER -> { if (reporterId != null) ids.add(reporterId); }
                case ASSIGNEE -> { if (assigneeId != null) ids.add(assigneeId); }
                case MANAGERS -> ids.addAll(managerIds);
                case HANDOVER_TARGET -> { if (handoverTargetId != null) ids.add(handoverTargetId); }
                case PREVIOUS_ASSIGNEE -> { if (previousAssigneeId != null) ids.add(previousAssigneeId); }
            }
        }
        return ids;
    }
}
