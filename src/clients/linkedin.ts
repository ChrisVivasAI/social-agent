import Arcade from "@arcadeai/arcadejs";
import { AuthorizeUserResponse } from "./types.js";

interface LinkedInPost {
  author: string;
  lifecycleState: string;
  specificContent: {
    "com.linkedin.ugc.ShareContent": {
      shareCommentary: {
        text: string;
      };
      shareMediaCategory: string;
    };
  };
  visibility: {
    "com.linkedin.ugc.MemberNetworkVisibility": string;
  };
}

interface CreateLinkedInImagePostRequest {
  text: string;
  imageUrl: string;
  imageDescription?: string;
  imageTitle?: string;
}

interface MediaUploadResponse {
  value: {
    uploadMechanism: {
      "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest": {
        headers: Record<string, string>;
        uploadUrl: string;
      };
    };
    mediaArtifact: string;
    asset: string;
  };
}

interface RegisterUploadRequest {
  registerUploadRequest: {
    recipes: string[];
    owner: string;
    serviceRelationships: Array<{
      relationshipType: string;
      identifier: string;
    }>;
  };
}

export class LinkedInClient {
  private baseURL = "https://api.linkedin.com/v2";
  private accessToken: string;
  private personUrn: string | undefined;
  private organizationId: string | undefined;

  constructor(input?: {
    accessToken: string | undefined;
    personUrn: string | undefined;
    organizationId: string | undefined;
  }) {
    const { accessToken, personUrn, organizationId } = {
      accessToken: process.env.LINKEDIN_ACCESS_TOKEN || input?.accessToken,
      organizationId:
        process.env.LINKEDIN_ORGANIZATION_ID || input?.organizationId,
      personUrn: process.env.LINKEDIN_PERSON_URN || input?.personUrn,
    };
    if (!accessToken) {
      throw new Error(
        "Missing LinkedIn access token. Please pass it via the constructor, or set the LINKEDIN_ACCESS_TOKEN environment variable.",
      );
    }
    if (!personUrn && !organizationId) {
      throw new Error(
        "Must provide at least one of personUrn or organizationId.",
      );
    }

    this.accessToken = accessToken;
    this.personUrn = personUrn;
    this.organizationId = organizationId;
  }

  /**
   * Returns the author string for making a post with the LinkedIn API.
   * @param options
   * @throws {Error} If neither personUrn nor organizationId is provided
   */
  private getAuthorString(options?: { postToOrganization?: boolean }): string {
    let author: string | undefined = undefined; // Variable to hold the final author string
    // First, attempt to use the organization ID if either the postToOrganization option is set, or the personUrn is not set
    if (options?.postToOrganization || !this.personUrn) {
      if (!this.organizationId) {
        console.error("LinkedInClient: Attempted to get author string for organization, but organizationId is missing."); // Added log
        throw new Error(
          "Missing organization ID. Please pass it via the constructor, or set the LINKEDIN_ORGANIZATION_ID environment variable.",
        );
      }
      author = `urn:li:organization:${this.organizationId}`; // Assign to author variable
    } else { // Use person URN only if organization was not selected and personUrn exists
      if (!this.personUrn) {
         console.error("LinkedInClient: Attempted to get author string for person, but personUrn is missing."); // Added log
        throw new Error(
          "Missing person URN. Please pass it via the constructor, or set the LINKEDIN_PERSON_URN environment variable.",
        );
      }
      author = `urn:li:person:${this.personUrn}`; // Assign to author variable
    }

    if (!author) {
       console.error("LinkedInClient: Failed to determine author string. Person URN:", this.personUrn, "Org ID:", this.organizationId, "Options:", options); // Added log
       // This case should ideally not be reached if the logic above is sound, but added as a safeguard.
       throw new Error("Could not determine LinkedIn author string.");
    }

    console.log(`LinkedInClient: Determined author string: ${author}`); // Added log
    return author; // Return the determined author string
  }

  // Helper for making API requests
  private async makeRequest<T = any>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.accessToken}`,
      "X-Restli-Protocol-Version": "2.0.0", // Ensure this header is present
      ...options.headers,
    };

    console.log(`LinkedInClient: Making request to ${endpoint}`, { // Added log
      method: options.method || 'GET',
      headers: {
        ...headers,
        Authorization: 'Bearer [REDACTED]' // Avoid logging token
      },
      body: options.body ? String(options.body).substring(0, 500) + (String(options.body).length > 500 ? '...' : '') : undefined // Log truncated body
    });

    const response = await fetch(endpoint, { ...options, headers });

    console.log(`LinkedInClient: Received response status ${response.status} ${response.statusText} from ${endpoint}`); // Added log

    if (!response.ok) {
      // Attempt to get error details from LinkedIn response
      let errorBody = "No error body available.";
      try {
        errorBody = await response.text(); // Get raw text body
      } catch (e) {
        console.error("LinkedInClient: Failed to parse error body text:", e);
      }
      // Log the raw error body regardless of parsing success
      console.error(`LinkedInClient: API Error Response Status: ${response.status} ${response.statusText}`); // Log status
      console.error("LinkedInClient: API Error Response Body:", errorBody); // Log the raw error body
      throw new Error(
        `LinkedIn API request failed: ${response.status} ${response.statusText}. Body: ${errorBody}`
      );
    }

    // LinkedIn UGC Posts returns 201 Created with location header and empty body on success.
    // Other successful requests might return 200 OK with a JSON body.
    if (response.status === 201 || response.status === 200) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
             try {
                const jsonBody = await response.json();
                console.log(`LinkedInClient: API Success (${response.status}) with JSON body from ${endpoint}:`, jsonBody); // Added log
                return jsonBody as T;
             } catch (e) {
                console.error(`LinkedInClient: Failed to parse JSON success response body from ${endpoint}:`, e); // Added log
                // Even if parsing fails, it was technically a success status code.
                // Return something indicative, maybe the raw response? Or just status?
                 return { status: response.status, statusText: response.statusText, headers: response.headers } as T; // Return status and headers
             }
        } else {
             // Handle non-JSON success responses (like 201 Created with no body)
            console.log(`LinkedInClient: API Success (${response.status}) with non-JSON or empty body from ${endpoint}. Location Header: ${response.headers.get('location')}`); // Added log
            // Return something indicative of success, maybe including headers
            return { status: response.status, statusText: response.statusText, headers: response.headers } as T; // Return status and headers
        }
    }


    // Fallback for other potential success statuses (though less common for these endpoints)
    console.warn(`LinkedInClient: Received unexpected success status ${response.status} from ${endpoint}. Attempting to parse as JSON.`); // Added warning
    try {
        const jsonBody = await response.json();
        console.log(`LinkedInClient: Parsed body for unexpected success status ${response.status}:`, jsonBody); // Added log
        return jsonBody;
    } catch (e) {
        console.error(`LinkedInClient: Failed to parse body for unexpected success status ${response.status}:`, e); // Added log
        // Return minimal info if parsing fails
        return { status: response.status, statusText: response.statusText } as T;
    }
  }

  // Create a text-only post
  async createTextPost(
    text: string,
    options?: {
      postToOrganization?: boolean;
    },
  ): Promise<Response> {
    const endpoint = `${this.baseURL}/ugcPosts`;
    const author = this.getAuthorString(options);

    const postData: LinkedInPost = {
      author,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: {
            text: text,
          },
          shareMediaCategory: "NONE",
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    };

    return this.makeRequest(endpoint, {
      method: "POST",
      body: JSON.stringify(postData),
    });
  }

  private async registerAndUploadMedia(
    imageUrl: string,
    options: {
      author: string;
    },
  ): Promise<string> {
    // Step 1: Register the upload
    const registerEndpoint = `${this.baseURL}/assets?action=registerUpload`;

    const registerData: RegisterUploadRequest = {
      registerUploadRequest: {
        recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
        owner: options.author,
        serviceRelationships: [
          {
            relationshipType: "OWNER",
            identifier: "urn:li:userGeneratedContent",
          },
        ],
      },
    };

    const registerResponse = await this.makeRequest<MediaUploadResponse>(
      registerEndpoint,
      {
        method: "POST",
        body: JSON.stringify(registerData),
      },
    );

    // Step 2: Get the image data from the URL
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();

    // Step 3: Upload the image to LinkedIn
    const uploadUrl =
      registerResponse.value.uploadMechanism[
        "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
      ].uploadUrl;

    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/octet-stream",
      },
      body: imageBuffer,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload image: ${uploadResponse.statusText}`);
    }

    return registerResponse.value.asset;
  }

  // Create a post with an image
  async createImagePost(
    {
      text,
      imageUrl,
      imageDescription,
      imageTitle,
    }: CreateLinkedInImagePostRequest,
    options?: {
      postToOrganization?: boolean;
    },
  ): Promise<Response> {
    // First register and upload the media
    const author = this.getAuthorString(options);
    const mediaAsset = await this.registerAndUploadMedia(imageUrl, { author });

    const endpoint = `${this.baseURL}/ugcPosts`;

    const postData = {
      author,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: {
            text,
          },
          shareMediaCategory: "IMAGE",
          media: [
            {
              status: "READY",
              description: {
                text: imageDescription ?? "Image description",
              },
              media: mediaAsset,
              title: {
                text: imageTitle ?? "Image title",
              },
            },
          ],
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    };

    return this.makeRequest(endpoint, {
      method: "POST",
      body: JSON.stringify(postData),
    });
  }

  static getScopes(postToOrg?: boolean): string[] {
    return postToOrg
      ? ["w_member_social", "w_organization_social"]
      : ["w_member_social"];
  }

  /**
   * Authorizes a user through Arcade's OAuth flow for LinkedIn access.
   * This method is used exclusively in Arcade authentication mode.
   *
   * @param {string} id - The user's unique identifier in your system
   * @param {Arcade} client - An initialized Arcade client instance
   * @returns {Promise<AuthorizeUserResponse>} Object containing either an authorization URL or token
   * @throws {Error} If authorization fails or required tokens are missing
   */
  static async authorizeUser(
    id: string,
    client: Arcade,
    fields?: {
      postToOrganization?: boolean;
    },
  ): Promise<AuthorizeUserResponse> {
    const scopes = LinkedInClient.getScopes(fields?.postToOrganization);
    const authRes = await client.auth.start(id, "linkedin", {
      scopes,
    });

    if (authRes.status === "completed") {
      if (!authRes.context?.token) {
        throw new Error(
          "Authorization status is completed, but token not found",
        );
      }
      return { token: authRes.context.token };
    }

    if (authRes.url) {
      return { authorizationUrl: authRes.url };
    }

    throw new Error(
      `Authorization failed for user ID: ${id}\nStatus: '${authRes.status}'`,
    );
  }

  static async fromArcade(
    linkedInUserId: string,
    fields?: {
      postToOrganization?: boolean;
    },
  ): Promise<LinkedInClient> {
    const arcade = new Arcade({
      apiKey: process.env.ARCADE_API_KEY,
    });
    const scopes = LinkedInClient.getScopes(fields?.postToOrganization);
    const authRes = await arcade.auth.start(linkedInUserId, "linkedin", {
      scopes,
    });

    if (!authRes.context?.token || !authRes.context?.user_info?.sub) {
      throw new Error(
        "Authorization not completed for user ID: " + linkedInUserId,
      );
    }

    return new LinkedInClient({
      accessToken: authRes.context.token,
      personUrn: authRes.context.user_info.sub as string,
      organizationId: undefined,
    });
  }
}
