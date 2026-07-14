package com.tarim.examdeck;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class AndroidAppConfigTest {
    @Test
    public void releaseIdentityUsesStablePackageAndVersion() {
        assertEquals("com.tarim.examdeck", BuildConfig.APPLICATION_ID);
        assertTrue(BuildConfig.VERSION_NAME.matches("\\d+\\.\\d+\\.\\d+"));
        String[] parts = BuildConfig.VERSION_NAME.split("\\.");
        int expectedVersionCode = Integer.parseInt(parts[0]) * 1_000_000
                + Integer.parseInt(parts[1]) * 1_000
                + Integer.parseInt(parts[2]);
        assertEquals(expectedVersionCode, BuildConfig.VERSION_CODE);
    }
}
