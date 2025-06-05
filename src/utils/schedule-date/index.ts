import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { isValid, addDays, isSunday, isMonday, format } from "date-fns";
import {
  getNextFriday,
  getNextMonday,
  getNextSaturday,
  isMondayOrFriday,
  isWeekend,
} from "./helpers.js";
import { toZonedTime } from "date-fns-tz";
import { DateType } from "../../agents/types.js";
import { DiscordClient } from "../../clients/discord/index.js";
import {
  FIRST_ALLOWED_P1_HOUR,
  ALLOWED_P2_DAY_AND_TIMES_IN_UTC,
  ALLOWED_P3_DAY_AND_TIMES_IN_UTC,
  LAST_ALLOWED_P1_HOUR,
  LAST_ALLOWED_P2_HOUR_WEEKDAY,
  FIRST_ALLOWED_P2_HOUR_WEEKDAY,
  FIRST_ALLOWED_P2_HOUR_WEEKEND,
  LAST_ALLOWED_P2_HOUR_WEEKEND,
  ALLOWED_P1_DAY_AND_TIMES_IN_UTC,
  ALLOWED_R1_DAY_AND_TIMES_IN_UTC,
  ALLOWED_R2_DAY_AND_TIMES_IN_UTC,
  ALLOWED_R3_DAY_AND_TIMES_IN_UTC,
  DEFAULT_TAKEN_DATES,
} from "./constants.js";
import { TakenScheduleDates } from "./types.js";

/**
 * Calculates a future date by adding seconds to a base date and formats it as MM/DD HH:MM AM/PM PST
 * @param afterSeconds - Number of seconds to add to the base date
 * @returns string representing the future date in format MM/DD HH:MM AM/PM PST
 */
export function getFutureDate(afterSeconds: number): string {
  const baseDate = new Date();
  const futureDate = new Date(baseDate.getTime() + afterSeconds * 1000);

  // Convert to PST
  const pstDate = toZonedTime(futureDate, "America/Los_Angeles");

  // Format the date
  return format(pstDate, "MM/dd hh:mm a").toUpperCase() + " PST";
}

export function validateAfterSeconds(afterSeconds: number): boolean {
  // Allow a small buffer (10 minutes in the past) to account for time zone issues
  return afterSeconds >= -600;
}

const NAMESPACE = ["taken_schedule_dates"];
const KEY = "dates";
const TAKEN_DATES_KEY = "taken_dates";

/**
 * Searches the store for all taken schedule dates
 * @param config
 * @returns {Promise<TakenScheduleDates>} The taken schedule dates, or DEFAULT_TAKEN_DATES if no dates are taken
 */
export async function getTakenScheduleDates(
  config: LangGraphRunnableConfig,
): Promise<TakenScheduleDates> {
  const { store } = config;
  if (!store) {
    throw new Error("No store provided");
  }
  const takenDates = await store.get(NAMESPACE, KEY);
  if (!takenDates) {
    return DEFAULT_TAKEN_DATES;
  }
  const storedDates = takenDates.value?.[TAKEN_DATES_KEY];
  // Convert stored string dates back to Date objects
  return {
    p1: storedDates?.p1?.map((d: string) => new Date(d)) || [],
    p2: storedDates?.p2?.map((d: string) => new Date(d)) || [],
    p3: storedDates?.p3?.map((d: string) => new Date(d)) || [],
    r1: storedDates?.r1?.map((d: string) => new Date(d)) || [],
    r2: storedDates?.r2?.map((d: string) => new Date(d)) || [],
    r3: storedDates?.r3?.map((d: string) => new Date(d)) || [],
  };
}

/**
 * Updates the store with a new taken scheduled date
 * @param {TakenScheduleDates} takenDates The new taken schedule dates
 * @param {LangGraphRunnableConfig} config
 * @returns {Promise<void>}
 */
export async function putTakenScheduleDates(
  takenDates: TakenScheduleDates,
  config: LangGraphRunnableConfig,
): Promise<void> {
  const { store } = config;
  if (!store) {
    throw new Error("No store provided");
  }
  // Convert Date objects to ISO strings for storage
  const serializedDates = {
    p1: takenDates.p1.map((d) => d.toISOString()),
    p2: takenDates.p2.map((d) => d.toISOString()),
    p3: takenDates.p3.map((d) => d.toISOString()),
    r1: takenDates.r1.map((d) => d.toISOString()),
    r2: takenDates.r2.map((d) => d.toISOString()),
    r3: takenDates.r3.map((d) => d.toISOString()),
  };
  await store.put(NAMESPACE, KEY, {
    [TAKEN_DATES_KEY]: serializedDates,
  });
}

function getAfterSeconds(date: Date, baseDate: Date = new Date()): number {
  return Math.floor((date.getTime() - baseDate.getTime()) / 1000);
}

interface GetNextAvailableDateParams {
  dateToCheck: Date;
  priority: "p1" | "p2" | "p3";
  takenDates: TakenScheduleDates;
}

/**
 * Given an input date, priority level, and taken dates,
 * returns an available date on that day, or undefined if
 * no times are available that day.
 */
function getNextAvailableDate({
  dateToCheck,
  priority,
  takenDates,
}: GetNextAvailableDateParams): Date {
  const takenDatesForPriority = takenDates[priority];
  let candidate: Date;

  // -- Existing logic --
  if (!takenDatesForPriority.length) {
    const day = dateToCheck.getUTCDay();
    if (priority === "p1") {
      candidate = new Date(
        Date.UTC(
          dateToCheck.getUTCFullYear(),
          dateToCheck.getUTCMonth(),
          dateToCheck.getUTCDate(),
          FIRST_ALLOWED_P1_HOUR,
        ),
      );
    } else if (priority === "p2") {
      const allowedHour = ALLOWED_P2_DAY_AND_TIMES_IN_UTC.find(
        (d) => d.day === day,
      )?.hour;
      if (allowedHour === undefined)
        throw new Error("Unreachable code (no p2 hour found).");
      candidate = new Date(
        Date.UTC(
          dateToCheck.getUTCFullYear(),
          dateToCheck.getUTCMonth(),
          dateToCheck.getUTCDate(),
          allowedHour,
        ),
      );
    } else {
      // p3
      const allowedHour = ALLOWED_P3_DAY_AND_TIMES_IN_UTC.find(
        (d) => d.day === day,
      )?.hour;
      if (allowedHour === undefined)
        throw new Error("Unreachable code (no p3 hour found).");
      candidate = new Date(
        Date.UTC(
          dateToCheck.getUTCFullYear(),
          dateToCheck.getUTCMonth(),
          dateToCheck.getUTCDate(),
          allowedHour,
        ),
      );
    }
  } else {
    // If there's already a date for this priority, continue from the last taken date
    const lastTakenDate =
      takenDatesForPriority[takenDatesForPriority.length - 1];
    const lastHour = lastTakenDate.getUTCHours();

    if (priority === "p1") {
      if (lastHour < LAST_ALLOWED_P1_HOUR) {
        candidate = new Date(
          Date.UTC(
            lastTakenDate.getUTCFullYear(),
            lastTakenDate.getUTCMonth(),
            lastTakenDate.getUTCDate(),
            lastHour + 1,
          ),
        );
      } else {
        const nextDay = addDays(lastTakenDate, 1);
        if (isSunday(nextDay)) {
          candidate = new Date(
            Date.UTC(
              nextDay.getUTCFullYear(),
              nextDay.getUTCMonth(),
              nextDay.getUTCDate(),
              FIRST_ALLOWED_P1_HOUR,
            ),
          );
        } else {
          const nextSat = getNextSaturday(lastTakenDate);
          candidate = new Date(
            Date.UTC(
              nextSat.getUTCFullYear(),
              nextSat.getUTCMonth(),
              nextSat.getUTCDate(),
              FIRST_ALLOWED_P1_HOUR,
            ),
          );
        }
      }
    } else if (priority === "p2") {
      if (isMondayOrFriday(lastTakenDate)) {
        if (lastHour < LAST_ALLOWED_P2_HOUR_WEEKDAY) {
          candidate = new Date(
            Date.UTC(
              lastTakenDate.getUTCFullYear(),
              lastTakenDate.getUTCMonth(),
              lastTakenDate.getUTCDate(),
              lastHour + 1,
            ),
          );
        } else if (isMonday(lastTakenDate)) {
          const nextFri = getNextFriday(lastTakenDate);
          candidate = new Date(
            Date.UTC(
              nextFri.getUTCFullYear(),
              nextFri.getUTCMonth(),
              nextFri.getUTCDate(),
              FIRST_ALLOWED_P2_HOUR_WEEKDAY,
            ),
          );
        } else {
          const nextSat = getNextSaturday(lastTakenDate);
          candidate = new Date(
            Date.UTC(
              nextSat.getUTCFullYear(),
              nextSat.getUTCMonth(),
              nextSat.getUTCDate(),
              FIRST_ALLOWED_P2_HOUR_WEEKEND,
            ),
          );
        }
      } else if (isWeekend(lastTakenDate)) {
        if (lastHour < LAST_ALLOWED_P2_HOUR_WEEKEND) {
          candidate = new Date(
            Date.UTC(
              lastTakenDate.getUTCFullYear(),
              lastTakenDate.getUTCMonth(),
              lastTakenDate.getUTCDate(),
              lastHour + 1,
            ),
          );
        } else {
          const nextDay = addDays(lastTakenDate, 1);
          if (isSunday(nextDay)) {
            candidate = new Date(
              Date.UTC(
                nextDay.getUTCFullYear(),
                nextDay.getUTCMonth(),
                nextDay.getUTCDate(),
                FIRST_ALLOWED_P2_HOUR_WEEKEND,
              ),
            );
          } else {
            const nextMon = getNextMonday(lastTakenDate);
            candidate = new Date(
              Date.UTC(
                nextMon.getUTCFullYear(),
                nextMon.getUTCMonth(),
                nextMon.getUTCDate(),
                FIRST_ALLOWED_P2_HOUR_WEEKDAY,
              ),
            );
          }
        }
      } else {
        const nextFri = getNextFriday(lastTakenDate);
        candidate = new Date(
          Date.UTC(
            nextFri.getUTCFullYear(),
            nextFri.getUTCMonth(),
            nextFri.getUTCDate(),
            FIRST_ALLOWED_P2_HOUR_WEEKDAY,
          ),
        );
      }
    } else {
      // p3
      const d = lastTakenDate.getUTCDay();
      const h = lastTakenDate.getUTCHours();
      const sameDaySlots = ALLOWED_P3_DAY_AND_TIMES_IN_UTC.filter(
        (slot) => slot.day === d && slot.hour > h,
      ).sort((a, b) => a.hour - b.hour);

      if (sameDaySlots.length) {
        candidate = new Date(
          Date.UTC(
            lastTakenDate.getUTCFullYear(),
            lastTakenDate.getUTCMonth(),
            lastTakenDate.getUTCDate(),
            sameDaySlots[0].hour,
          ),
        );
      } else {
        // Move day-by-day
        let tmp = new Date(
          Date.UTC(
            lastTakenDate.getUTCFullYear(),
            lastTakenDate.getUTCMonth(),
            lastTakenDate.getUTCDate(),
          ),
        );
        tmp = addDays(tmp, 1);
        candidate = undefined as unknown as Date;

        for (let i = 0; i < 14; i += 1) {
          const dayCheck = tmp.getUTCDay();
          const validSlots = ALLOWED_P3_DAY_AND_TIMES_IN_UTC.filter(
            (slot) => slot.day === dayCheck,
          ).sort((a, b) => a.hour - b.hour);
          if (validSlots.length) {
            candidate = new Date(
              Date.UTC(
                tmp.getUTCFullYear(),
                tmp.getUTCMonth(),
                tmp.getUTCDate(),
                validSlots[0].hour,
              ),
            );
            break;
          }
          tmp = addDays(tmp, 1);
        }
        if (!candidate) {
          throw new Error("Couldn't find a valid p3 slot within 2 weeks.");
        }
      }
    }
  }

  // -- Ensure candidate is never in the past --
  if (candidate < dateToCheck) {
    // We'll shift forward day-by-day to find the next valid slot after dateToCheck
    let tmp = new Date(
      Date.UTC(
        dateToCheck.getUTCFullYear(),
        dateToCheck.getUTCMonth(),
        dateToCheck.getUTCDate(),
        dateToCheck.getUTCHours(),
      ),
    );
    for (let i = 0; i < 14; i += 1) {
      const day = tmp.getUTCDay();
      const currentHour = tmp.getUTCHours();
      const allowedSlots =
        priority === "p1"
          ? ALLOWED_P1_DAY_AND_TIMES_IN_UTC
          : priority === "p2"
            ? ALLOWED_P2_DAY_AND_TIMES_IN_UTC
            : ALLOWED_P3_DAY_AND_TIMES_IN_UTC;

      // Only allow hours >= currentHour, but if we're exactly on currentHour, minutes must be 0
      const validSlots = allowedSlots
        .filter((s) => s.day === day)
        .filter((s) => {
          // skip all slots strictly less than current hour, or equal.
          if (s.hour <= currentHour) return false;
          return true;
        })
        .sort((a, b) => a.hour - b.hour);

      if (validSlots.length) {
        candidate = new Date(
          Date.UTC(
            tmp.getUTCFullYear(),
            tmp.getUTCMonth(),
            tmp.getUTCDate(),
            validSlots[0].hour,
          ),
        );
        // Now candidate is guaranteed >= dateToCheck
        break;
      }

      // move to next day at midnight
      tmp = new Date(
        Date.UTC(tmp.getUTCFullYear(), tmp.getUTCMonth(), tmp.getUTCDate() + 1),
      );
    }
    if (candidate < dateToCheck) {
      throw new Error(
        `No valid future slot found for ${priority} within 2 weeks of ${dateToCheck}`,
      );
    }
  }

  return candidate;
}

function validateScheduleDate(date: Date, baseDate: Date): boolean {
  const afterSeconds = getAfterSeconds(date, baseDate);
  return validateAfterSeconds(afterSeconds);
}

interface FindAvailableRepurposeDatesRepurposer {
  repurposedPriority: "r1" | "r2" | "r3";
  baseDate: Date;
  numberOfDates: number;
  takenDates: TakenScheduleDates;
  /**
   * @default 1
   */
  numWeeksBetween?: number;
}

function normalizeSlots(
  slots: { day: number; hour: number }[],
): { day: number; hour: number }[] {
  // Move "hour=0" to the previous day as "hour=24"
  return slots.map((slot) => {
    if (slot.hour === 0) {
      return {
        day: slot.day - 1,
        hour: 24,
      };
    }
    return slot;
  });
}

// Optional little helper to avoid confusion when setting "hour=24":
function setUTCHoursExtended(base: Date, hour: number) {
  // set to 00:00 first:
  base.setUTCHours(0, 0, 0, 0);
  // then add "hour" hours in milliseconds
  base.setTime(base.getTime() + hour * 60 * 60 * 1000);
}

export function findAvailableRepurposeDates({
  repurposedPriority,
  baseDate,
  numberOfDates,
  takenDates: allTakenDates,
  numWeeksBetween = 1,
}: FindAvailableRepurposeDatesRepurposer): Date[] {
  const results: Date[] = [];
  let weekOffset = 0;

  const takenDates = allTakenDates[repurposedPriority];

  // Pick which raw slots to use
  const rawAllowedSlots =
    repurposedPriority === "r1"
      ? ALLOWED_R1_DAY_AND_TIMES_IN_UTC
      : repurposedPriority === "r2"
        ? ALLOWED_R2_DAY_AND_TIMES_IN_UTC
        : ALLOWED_R3_DAY_AND_TIMES_IN_UTC;

  // Normalize them so day+1, hour=0 becomes day, hour=24
  const allowedSlots = normalizeSlots(rawAllowedSlots);

  // We'll allow searching up to 52 weeks (1 year) in the future to avoid infinite loops
  while (results.length < numberOfDates && weekOffset < 52) {
    // Start from Monday of the current week
    const checkDate = new Date(baseDate.getTime());
    checkDate.setUTCHours(0, 0, 0, 0);

    // Move to Monday (day 1) of the current week if we're not already there
    const currentDay = checkDate.getUTCDay();
    const daysToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    checkDate.setUTCDate(
      checkDate.getUTCDate() + daysToMonday + weekOffset * 7,
    );

    let foundSlotThisWeek = false;

    // Try each day of the week (Monday-Friday)
    for (let dayOffset = 0; dayOffset < 5 && !foundSlotThisWeek; dayOffset++) {
      const candidateDay = new Date(checkDate.getTime());
      candidateDay.setUTCDate(candidateDay.getUTCDate() + dayOffset);
      const dayOfWeek = candidateDay.getUTCDay();

      // Get allowed slots for this day
      const sameDaySlots = allowedSlots
        .filter((slot) => slot.day === dayOfWeek)
        .sort((a, b) => a.hour - b.hour);

      // Try each time slot for this day
      for (const slot of sameDaySlots) {
        const candidate = new Date(candidateDay.getTime());
        setUTCHoursExtended(candidate, slot.hour);

        // Ensure it's strictly in the future
        if (candidate <= baseDate) {
          continue;
        }

        // Check if already taken
        const alreadyTaken = takenDates.some((taken) => {
          return (
            taken.getUTCFullYear() === candidate.getUTCFullYear() &&
            taken.getUTCMonth() === candidate.getUTCMonth() &&
            taken.getUTCDate() === candidate.getUTCDate() &&
            taken.getUTCHours() === candidate.getUTCHours()
          );
        });

        if (!alreadyTaken) {
          results.push(candidate);
          foundSlotThisWeek = true;
          break;
        }
      }
    }

    weekOffset += numWeeksBetween;
  }

  return results;
}

interface FindAvailableBasicDateParams {
  baseDate: Date;
  _config: LangGraphRunnableConfig;
  priority: "p1" | "p2" | "p3";
  takenScheduleDates: TakenScheduleDates;
}

async function findAvailableBasicDates({
  baseDate,
  _config: _config,
  priority,
  takenScheduleDates,
}: FindAvailableBasicDateParams): Promise<Date> {
  let availableDate: Date | undefined;
  let attempts = 0;
  let currentDateToCheck = baseDate;

  while (!availableDate && attempts < 365) {
    // Limit attempts to avoid infinite loops
    if (priority === "p1") {
      if (
        !ALLOWED_P1_DAY_AND_TIMES_IN_UTC.some(
          (d) => d.day === currentDateToCheck.getUTCDay(),
        )
      ) {
        currentDateToCheck = addDays(currentDateToCheck, 1);
        attempts++;
        continue;
      }
    } else if (priority === "p2") {
      if (
        !ALLOWED_P2_DAY_AND_TIMES_IN_UTC.some(
          (d) => d.day === currentDateToCheck.getUTCDay(),
        )
      ) {
        currentDateToCheck = addDays(currentDateToCheck, 1);
        attempts++;
        continue;
      }
    } else {
      // p3
      if (
        !ALLOWED_P3_DAY_AND_TIMES_IN_UTC.some(
          (d) => d.day === currentDateToCheck.getUTCDay(),
        )
      ) {
        currentDateToCheck = addDays(currentDateToCheck, 1);
        attempts++;
        continue;
      }
    }
    availableDate = getNextAvailableDate({
      dateToCheck: currentDateToCheck,
      priority,
      takenDates: takenScheduleDates,
    });

    if (!availableDate) {
      currentDateToCheck = addDays(currentDateToCheck, 1);
    }
    attempts++;
  }

  if (!availableDate) {
    // Send a message to Discord if no date is found
    const discordChannelId = process.env.DISCORD_CHANNEL_ID;
    const discordChannelName = process.env.DISCORD_CHANNEL_NAME;

    if (discordChannelId || discordChannelName) {
      const clientArgs: any = {};
      if (discordChannelId) {
        clientArgs.channelId = discordChannelId;
      } else if (discordChannelName) {
        clientArgs.channelName = discordChannelName;
      }
      const discordClient = new DiscordClient(clientArgs);
      try {
        await discordClient.sendMessage(
          `**FAILED TO FIND DATE TO SCHEDULE POST**\nPriority: ${priority}\nBase Date: ${baseDate.toISOString()}`,
        );
      } catch (err) {
        console.error("Failed to send Discord notification for scheduling failure:", err);
      }
    } else {
      console.warn("No Discord channel configured for scheduling failure notifications.")
    }
    throw new Error(
      `Could not find available date for priority ${priority} after ${attempts} attempts. Base date: ${baseDate.toISOString()}`,
    );
  }
  return availableDate;
}

const isRepurposedPriority = (
  priority: DateType,
): priority is "r1" | "r2" | "r3" => {
  return typeof priority === "string" && ["r1", "r2", "r3"].includes(priority);
};

const isBasicPriority = (
  priority: DateType,
): priority is "p1" | "p2" | "p3" => {
  return typeof priority === "string" && ["p1", "p2", "p3"].includes(priority);
};

type GetScheduledBasicDateArgs = {
  scheduleDate: DateType;
  config: LangGraphRunnableConfig;
  baseDate?: Date;
};

type GetScheduledRepurposeDateArgs = GetScheduledBasicDateArgs & {
  numberOfDates: number;
  numWeeksBetween: number;
};

export async function getScheduledDateSeconds(
  args: GetScheduledBasicDateArgs,
): Promise<number>;

export async function getScheduledDateSeconds(
  args: GetScheduledRepurposeDateArgs,
): Promise<number[]>;

export async function getScheduledDateSeconds(
  args: GetScheduledBasicDateArgs | GetScheduledRepurposeDateArgs,
): Promise<number | number[]> {
  const { scheduleDate, config, baseDate, numberOfDates, numWeeksBetween } = {
    baseDate: new Date(),
    numberOfDates: undefined,
    numWeeksBetween: undefined,
    ...args,
  };
  if (isValid(scheduleDate)) {
    const afterSeconds = getAfterSeconds(scheduleDate as Date, baseDate);
    if (!validateAfterSeconds(afterSeconds)) {
      // If date appears to be in the past, add 24 hours to ensure it's in the future
      const adjustedDate = new Date((scheduleDate as Date).getTime() + 24 * 60 * 60 * 1000);
      const adjustedSeconds = getAfterSeconds(adjustedDate, baseDate);
      console.log(`Adjusted schedule date from ${scheduleDate} to ${adjustedDate}`);
      return adjustedSeconds;
    }
    return afterSeconds;
  }

  const takenScheduleDates = await getTakenScheduleDates(config);

  if (
    isRepurposedPriority(scheduleDate) &&
    numberOfDates !== undefined &&
    numWeeksBetween !== undefined
  ) {
    const scheduleDates = findAvailableRepurposeDates({
      repurposedPriority: scheduleDate,
      baseDate,
      numberOfDates,
      takenDates: takenScheduleDates,
      numWeeksBetween,
    });

    const isValidDate = scheduleDates.every((d) =>
      validateScheduleDate(d, baseDate),
    );
    if (!isValidDate) {
      throw new Error(`FAILED TO SCHEDULE POST
  
  Priority: ${scheduleDate}
  Schedule dates: ${scheduleDates.map((d) => format(d, "MM/dd/yyyy hh:mm a z")).join(", ")}
  Base date: ${format(baseDate, "MM/dd/yyyy hh:mm a z")}`);
    }

    takenScheduleDates[scheduleDate].push(...scheduleDates);
    await putTakenScheduleDates(takenScheduleDates, config);
    return scheduleDates.map((d) => getAfterSeconds(d, baseDate));
  } else if (
    isRepurposedPriority(scheduleDate) &&
    numberOfDates === undefined
  ) {
    throw new Error(
      "Must provide numberOfDates when scheduleDate is a repurposed priority",
    );
  }

  if (isBasicPriority(scheduleDate)) {
    const nextAvailDate = await findAvailableBasicDates({
      baseDate,
      _config: config,
      priority: scheduleDate,
      takenScheduleDates,
    });
    const isValidDate = validateScheduleDate(nextAvailDate, baseDate);
    if (!isValidDate) {
      throw new Error(`FAILED TO SCHEDULE POST
  
  Priority: ${scheduleDate}
  Schedule date: ${format(nextAvailDate, "MM/dd/yyyy hh:mm a z")}
  Base date: ${format(baseDate, "MM/dd/yyyy hh:mm a z")}`);
    }

    takenScheduleDates[scheduleDate].push(nextAvailDate);
    await putTakenScheduleDates(takenScheduleDates, config);
    return getAfterSeconds(nextAvailDate, baseDate);
  }

  throw new Error(`INVALID SCHEDULE DATE: "${scheduleDate}"
    
Must be one of: "r1", "r2", "r3", "p1", "p2", "p3", or a valid date object.
  `);
}
