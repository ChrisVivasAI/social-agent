import { LangGraphRunnableConfig } from "@langchain/langgraph";

const NAMESPACE = ["saved_data", "post_subject_urls"];
const KEY = "urls";
const OBJECT_KEY = "data";

/**
 * Save a list of URLs of which are the subject URLs of posts which have been curated.
 * @param urls The list of URLs to save
 * @param config The configuration for the langgraph
 * @param overwrite Whether to overwrite the stored URLs if they already exist.
 *  If true, it will overwrite. If false (default), it will first fetch the current stored URLs and add the new ones.
 * @returns {Promise<void>}
 */
export async function savePostSubjectUrls(
  urls: string[],
  config: LangGraphRunnableConfig,
  overwrite = false,
): Promise<void> {
  const store = config.store;
  if (!store) {
    throw new Error("No store provided");
  }

  const urlsToSaveSet = new Set(urls);
  if (!overwrite) {
    const existingUrls = await getPostSubjectUrls(config);
    existingUrls.forEach((url) => urlsToSaveSet.add(url));
  }

  await store.put(NAMESPACE, KEY, {
    [OBJECT_KEY]: Array.from(urlsToSaveSet),
  });
}

/**
 * Get the list of URLs of which are the subject URLs of posts which have been curated.
 * @param config The configuration for the langgraph
 * @returns {Promise<string[]>} The list of URLs which have been included in posts already.
 */
export async function getPostSubjectUrls(
  config: LangGraphRunnableConfig,
): Promise<string[]> {
  const store = config.store;
  if (!store) {
    throw new Error("No store provided");
  }
  const urls = await store.get(NAMESPACE, KEY);
  if (!urls) {
    return [];
  }
  return urls.value?.[OBJECT_KEY] || [];
}
