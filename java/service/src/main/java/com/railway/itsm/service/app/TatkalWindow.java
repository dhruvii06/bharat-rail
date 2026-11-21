package com.railway.itsm.service.app;

import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;

/** Tatkal booking opens at 10:00 (AC) and 11:00 (non-AC) IST; the first 30 minutes are peak load. */
public final class TatkalWindow {
    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    private TatkalWindow() {}

    public static boolean contains(Instant instant) {
        LocalTime t = instant.atZone(IST).toLocalTime();
        return within(t, LocalTime.of(10, 0)) || within(t, LocalTime.of(11, 0));
    }

    private static boolean within(LocalTime t, LocalTime opens) {
        return !t.isBefore(opens) && t.isBefore(opens.plusMinutes(30));
    }
}
