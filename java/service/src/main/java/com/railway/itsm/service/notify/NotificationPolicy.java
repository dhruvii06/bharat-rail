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
    public enum Audience { REPORTER, ASSIGNEE, MANAGERS }

    public enum Channel { IN_APP, EMAIL }

    private record Rule(Set<Audience> inApp, Set<Audience> email) {}

    private static final Set<Audience> NONE = Set.of();
    private static final Map<String, Rule> RULES = Map.ofEntries(
            Map.entry("CREATED", new Rule(Set.of(Audience.REPORTER, Audience.MANAGERS), Set.of(Audience.MANAGERS))),
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
            Map.entry("INFO_PROVIDED", new Rule(Set.of(Audience.ASSIGNEE), NONE)));

    public Set<Long> recipients(String eventType, Channel channel, Long reporterId, Long assigneeId, List<Long> managerIds) {
        Rule rule = RULES.get(eventType);
        if (rule == null) return Set.of();
        Set<Long> ids = new LinkedHashSet<>();
        for (Audience a : channel == Channel.IN_APP ? rule.inApp() : rule.email()) {
            switch (a) {
                case REPORTER -> { if (reporterId != null) ids.add(reporterId); }
                case ASSIGNEE -> { if (assigneeId != null) ids.add(assigneeId); }
                case MANAGERS -> ids.addAll(managerIds);
            }
        }
        return ids;
    }
}
