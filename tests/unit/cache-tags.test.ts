import { describe, it, expect } from "vitest";
import { ADMIN_CACHE_TAGS } from "@/lib/cache/admin-cache-tags";

describe("ADMIN_CACHE_TAGS", () => {
  it("contains all required admin domain tags", () => {
    expect(ADMIN_CACHE_TAGS.services).toBe("admin:services");
    expect(ADMIN_CACHE_TAGS.settings).toBe("admin:settings");
    expect(ADMIN_CACHE_TAGS.workingHours).toBe("admin:working_hours");
    expect(ADMIN_CACHE_TAGS.blockedDates).toBe("admin:blocked_dates");
    expect(ADMIN_CACHE_TAGS.timeBlocks).toBe("admin:time_blocks");
    expect(ADMIN_CACHE_TAGS.gallery).toBe("admin:gallery");
  });

  it("tag values are unique", () => {
    const values = Object.values(ADMIN_CACHE_TAGS);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });
});
