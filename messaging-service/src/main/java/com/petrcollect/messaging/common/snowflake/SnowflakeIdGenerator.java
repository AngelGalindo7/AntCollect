package com.petrcollect.messaging.common.snowflake;

import org.springframework.stereotype.Component;

/**
 * Twitter Snowflake ID Generator
 *
 * 64-bit ID layout:
 * [ 1 bit unused | 41 bits timestamp (ms) | 10 bits machine ID | 12 bits sequence ]
 */
@Component
public class SnowflakeIdGenerator {

    // Custom epoch: 2024-01-01T00:00:00Z in milliseconds
    private static final long CUSTOM_EPOCH = 1704067200000L;

    private static final long MACHINE_ID_BITS  = 10L;
    private static final long SEQUENCE_BITS    = 12L;

    private static final long MAX_MACHINE_ID   = ~(-1L << MACHINE_ID_BITS);   // 1023
    private static final long MAX_SEQUENCE     = ~(-1L << SEQUENCE_BITS);     // 4095

    private static final long MACHINE_ID_SHIFT  = SEQUENCE_BITS;              // 12
    private static final long TIMESTAMP_SHIFT   = SEQUENCE_BITS + MACHINE_ID_BITS; // 22

    // Hardcoded machine/datacenter ID = 1
    private static final long MACHINE_ID = 1L & MAX_MACHINE_ID;

    private long lastTimestamp = -1L;
    private long sequence      = 0L;

    /**
     * Generate the next unique Snowflake ID.
     *
     * @return a 64-bit unique ID
     * @throws RuntimeException if the system clock moves backward
     */
    public synchronized long next() {
        long now = currentMs();

        if (now < lastTimestamp) {
            throw new RuntimeException(
                String.format(
                    "Clock moved backwards. Refusing to generate ID for %d milliseconds.",
                    lastTimestamp - now
                )
            );
        }

        if (now == lastTimestamp) {
            sequence = (sequence + 1) & MAX_SEQUENCE;
            if (sequence == 0) {
                // Sequence exhausted — wait for next millisecond
                now = waitForNextMs(lastTimestamp);
            }
        } else {
            sequence = 0L;
        }

        lastTimestamp = now;

        return ((now - CUSTOM_EPOCH) << TIMESTAMP_SHIFT)
             | (MACHINE_ID           << MACHINE_ID_SHIFT)
             | sequence;
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private long currentMs() {
        return System.currentTimeMillis();
    }

    private long waitForNextMs(long lastTs) {
        long ts = currentMs();
        while (ts <= lastTs) {
            ts = currentMs();
        }
        return ts;
    }
}
