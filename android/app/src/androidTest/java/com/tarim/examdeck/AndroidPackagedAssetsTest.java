package com.tarim.examdeck;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.InputStream;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class AndroidPackagedAssetsTest {
    @Test
    public void packageNameAndRequiredOfflineAssetsArePresent() throws Exception {
        Context appContext = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertEquals("com.tarim.examdeck", appContext.getPackageName());

        try (InputStream index = appContext.getAssets().open("public/index.html");
             InputStream bootstrap = appContext.getAssets().open("public/bootstrap/progress.json")) {
            assertTrue(index.read() >= 0);
            assertTrue(bootstrap.read() >= 0);
        }
    }
}
