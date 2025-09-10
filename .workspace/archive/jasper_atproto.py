import asyncio
import json
import logging
import os
import subprocess
from datetime import datetime, UTC
from pathlib import Path
from typing import Dict, List, Optional, TypedDict, Any, Callable, Tuple
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Constants
DEFAULT_ATPROTO_HOST = "https://bsky.social"
TEST_MODE = False  # Must be False for actual posting to occur


# Types
class ATProtoCredentials(TypedDict):
    handle: str
    email: str
    password: str


class PostMetadata(TypedDict):
    uuid: str
    title: str
    url: Optional[str]
    posted_at: Optional[str]


# Global logger
logger = logging.getLogger("jasper.atproto")

# --- Data Handling ---


def load_atproto_credentials(
    creds_file: Path = Path("data/atproto_credentials.json"),
) -> Optional[ATProtoCredentials]:
    """
    Load AT Protocol credentials from environment variables or JSON file.

    First checks for BSKY_USER and BSKY_PASSWORD environment variables.
    If not found, falls back to the JSON file.
    """
    # First try to load from environment variables
    bsky_user = os.environ.get("BSKY_USER")
    bsky_password = os.environ.get("BSKY_PASSWORD")

    if bsky_user and bsky_password:
        logger.info(
            f"Using AT Protocol credentials from environment variables for {bsky_user}"
        )
        credentials: ATProtoCredentials = {
            "handle": bsky_user,
            "email": bsky_user,  # Using handle/user as email since Bluesky accepts either
            "password": bsky_password,
        }
        return credentials

    # Fall back to JSON file if environment variables not found
    if not creds_file.exists():
        logger.warning(
            f"Credentials file not found at {creds_file} and no environment variables set"
        )
        return None

    try:
        with open(creds_file, "r") as f:
            data = json.load(f)
            required_fields = ["handle", "email", "password"]
            if not all(field in data for field in required_fields):
                logger.warning(
                    f"Credentials file missing required fields: {required_fields}"
                )
                return None

            credentials: ATProtoCredentials = {
                "handle": data["handle"],
                "email": data["email"],
                "password": data["password"],
            }
            return credentials
    except Exception as e:
        logger.error(f"Error loading credentials from {creds_file}: {str(e)}")
        return None


def save_atproto_credentials(
    credentials: ATProtoCredentials,
    creds_file: Path = Path("data/atproto_credentials.json"),
) -> bool:
    """Save AT Protocol credentials to a JSON file."""
    try:
        creds_file.parent.mkdir(parents=True, exist_ok=True)

        with open(creds_file, "w") as f:
            json.dump(credentials, f, indent=2)

        logger.info(f"Saved AT Protocol credentials for {credentials['handle']}")
        return True
    except Exception as e:
        logger.error(f"Error saving credentials to {creds_file}: {str(e)}")
        return False


def load_atproto_posts_index(
    index_file: Path = Path("data/atproto_posts.json"),
) -> List[Dict]:
    """Load AT Protocol posts index from a JSON file."""
    if not index_file.exists():
        logger.warning(
            f"Posts index file not found at {index_file}, returning empty list."
        )
        return []

    try:
        with open(index_file, "r") as f:
            data = json.load(f)

            if not isinstance(data, dict) or "posts" not in data:
                logger.warning(
                    f"Posts index {index_file} has invalid structure, returning empty list."
                )
                return []

            if not isinstance(data["posts"], list):
                logger.error(f"Posts index {index_file} 'posts' key is not a list.")
                return []

            logger.info(f"Loaded {len(data['posts'])} posts from {index_file}")
            return data.get("posts", [])
    except Exception as e:
        logger.error(f"Error loading posts index file {index_file}: {str(e)}")
        return []


def save_atproto_posts_index(
    posts_data: List[Dict], index_file: Path = Path("data/atproto_posts.json")
) -> bool:
    """Save AT Protocol posts index to a JSON file."""
    try:
        index_file.parent.mkdir(parents=True, exist_ok=True)

        with open(index_file, "w") as f:
            json.dump({"posts": posts_data}, f, indent=2)

        logger.info(f"Saved {len(posts_data)} posts to {index_file}")
        return True
    except Exception as e:
        logger.error(f"Error saving posts index to {index_file}: {str(e)}")
        return False


def get_atproto_status(uuid_value: str, index_data: Optional[List[Dict]] = None) -> str:
    """Check if a file with given UUID has been posted to AT Protocol."""
    if uuid_value == "N/A" or not uuid_value:
        return "No UUID found"

    if index_data is None:
        index_data = load_atproto_posts_index()

    if not index_data:
        return "Not posted (index not found or empty)"

    for post in index_data:
        if post.get("uuid") == uuid_value:
            return "Posted" if post.get("url") else "Draft"

    return "Not posted"


# --- AT Protocol Interaction (Placeholder) ---


async def check_atproto_connection(
    credentials: Optional[ATProtoCredentials] = None,
) -> bool:
    """Check if we can connect to AT Protocol with given credentials."""
    if TEST_MODE:
        logger.info("TEST MODE: Simulating successful AT Protocol connection")
        await asyncio.sleep(0.5)
        return True

    if credentials is None:
        credentials = load_atproto_credentials()
        if not credentials:
            logger.error("No AT Protocol credentials found")
            return False

    # TODO: Implement actual connection check
    # For now, this is just a placeholder
    logger.info(
        f"Checking connection for {credentials['handle']} (no actual check implemented yet)"
    )
    await asyncio.sleep(0.5)
    return True


async def post_to_atproto(
    file_path: Path,
    credentials: Optional[ATProtoCredentials] = None,
    app_notify_callback: Optional[Callable[[str], None]] = None,
    user_text: str = "",  # Add parameter for user-composed text
) -> Optional[str]:
    """Post content from a file to AT Protocol."""
    # Log the TEST_MODE status at the beginning
    logger.info(f"DEBUGGING: post_to_atproto called with TEST_MODE={TEST_MODE}")

    if TEST_MODE:
        logger.info(f"TEST MODE: Simulating AT Protocol post for {file_path.name}")
        if user_text:
            logger.info(f"TEST MODE: User text: {user_text}")
        else:
            logger.info(f"TEST MODE: No user text provided, post would be empty")
        await asyncio.sleep(1.0)
        return f"https://bsky.app/profile/test.bsky.social/post/fake123"

    # Check if we have credentials (not needed for CLI but good to verify)
    if credentials is None:
        credentials = load_atproto_credentials()
        if not credentials:
            error_msg = "Cannot post: No AT Protocol credentials found"
            logger.error(error_msg)
            if app_notify_callback:
                app_notify_callback(error_msg)
            return None

    try:
        # Use the user's text as the post content
        post_content = user_text
        logger.info(f"DEBUGGING: Actual post content: '{post_content}'")

        if not post_content:
            error_msg = "Cannot post: Empty post content"
            logger.error(error_msg)
            if app_notify_callback:
                app_notify_callback(error_msg)
            return None

        # Check if the bsky CLI is installed
        is_cli_installed, cli_message = await check_bsky_cli_installed()
        logger.info(
            f"DEBUGGING: bsky CLI installed: {is_cli_installed}, message: {cli_message}"
        )

        if not is_cli_installed:
            error_msg = f"Cannot post: {cli_message}"
            logger.error(error_msg)
            if app_notify_callback:
                app_notify_callback(error_msg)
            return None

        # Check if the user is logged in
        logger.info("Checking if user is authenticated with Bluesky...")
        check_proc = await asyncio.create_subprocess_exec(
            "bsky",
            "show-session",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await check_proc.communicate()
        stdout_str = stdout.decode() if stdout else ""
        stderr_str = stderr.decode() if stderr else ""

        logger.info(
            f"DEBUGGING: bsky show-session result: code={check_proc.returncode}, stdout={stdout_str}"
        )

        if check_proc.returncode != 0:
            error_msg = "Cannot post: Not authenticated with Bluesky. Please run 'bsky login' in terminal"
            logger.error(error_msg)
            if app_notify_callback:
                app_notify_callback(error_msg)
            return None

        # Prepare the bsky post command
        logger.info(
            f"DEBUGGING: About to execute bsky post command with content: '{post_content}'"
        )
        if app_notify_callback:
            app_notify_callback("Posting to Bluesky...")

        # Use subprocess to run the bsky CLI command
        post_proc = await asyncio.create_subprocess_exec(
            "bsky",
            "post",
            post_content,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        logger.info(f"DEBUGGING: bsky post command executed, waiting for result...")
        stdout, stderr = await post_proc.communicate()
        stdout_str = stdout.decode() if stdout else ""
        stderr_str = stderr.decode() if stderr else ""

        # Log the output for debugging
        logger.info(
            f"DEBUGGING: bsky post command completed with return code: {post_proc.returncode}"
        )
        logger.info(f"bsky post stdout: {stdout_str}")
        if stderr_str:
            logger.info(f"bsky post stderr: {stderr_str}")

        if post_proc.returncode != 0:
            error_msg = f"Failed to post to Bluesky. Error: {stderr_str}"
            logger.error(error_msg)
            if app_notify_callback:
                app_notify_callback(error_msg)
            return None

        # Try to extract the post URL from the output
        # Pattern for Bluesky post URL or AT URI
        import re

        url_match = re.search(
            r"https://bsky\.app/profile/[^/]+/post/[^\s]+", stdout_str
        )
        at_uri_match = re.search(r"at://[^\s]+", stdout_str)

        logger.info(
            f"DEBUGGING: URL match found: {url_match is not None}, AT URI match found: {at_uri_match is not None}"
        )
        logger.info(f"DEBUGGING: Full stdout: '{stdout_str}'")

        if url_match:
            post_url = url_match.group(0)
            logger.info(f"Successfully posted to Bluesky: {post_url}")
            if app_notify_callback:
                app_notify_callback(f"Successfully posted to Bluesky: {post_url}")
            return post_url
        elif at_uri_match:
            # If we only have an AT URI, construct a web URL
            at_uri = at_uri_match.group(0)
            parts = at_uri.split("/")
            if len(parts) >= 4:
                handle = parts[2]
                post_id = parts[4]
                post_url = f"https://bsky.app/profile/{handle}/post/{post_id}"
                logger.info(f"Successfully posted to Bluesky: {post_url}")
                if app_notify_callback:
                    app_notify_callback(f"Successfully posted to Bluesky: {post_url}")
                return post_url
            else:
                # Return the AT URI as fallback
                logger.info(f"Posted to Bluesky with AT URI: {at_uri}")
                if app_notify_callback:
                    app_notify_callback(f"Posted to Bluesky (URI: {at_uri})")
                return at_uri
        else:
            # If we can't extract a URL but the command succeeded, return a generic success
            logger.info(
                "DEBUGGING: Posted to Bluesky successfully, but couldn't extract URL from output"
            )
            if app_notify_callback:
                app_notify_callback("Posted to Bluesky successfully")
            # Change this to help diagnose the problem - don't return the generic URL
            logger.info(
                "DEBUGGING: Instead of generic URL, returning command output as success indication"
            )
            return f"Command succeeded but couldn't extract URL. Output: {stdout_str[:100]}"

    except Exception as e:
        error_msg = f"Error posting to AT Protocol: {str(e)}"
        logger.error(error_msg)
        if app_notify_callback:
            app_notify_callback(error_msg)
        return None


# --- Main Post Orchestration ---


async def post_files_to_atproto(
    files_to_post: List[Path],
    app_notify_callback: Optional[Callable[[str], None]] = None,
    index_file: Path = Path("data/atproto_posts.json"),
    user_text: str = "",  # Add parameter for user-composed text
) -> Dict[Path, Optional[str]]:
    """
    Posts a list of files to AT Protocol, updates the index, and returns status.

    Args:
        files_to_post: List of file paths to post.
        app_notify_callback: Optional callback for UI notifications.
        index_file: Path to the AT Protocol posts index file.
        user_text: Optional user-composed text to include in the post.

    Returns:
        A dictionary mapping file paths to their resulting post URLs (or None if failed).
    """
    post_results: Dict[Path, Optional[str]] = {}

    # Add explicit debug log for TEST_MODE
    logger.info(f"DEBUGGING: post_files_to_atproto called with TEST_MODE={TEST_MODE}")

    if not files_to_post:
        logger.info("No files provided for AT Protocol posting.")
        return post_results

    credentials = load_atproto_credentials()
    if not credentials and not TEST_MODE:
        error_msg = "AT Protocol posting cannot proceed: No credentials found."
        logger.error(error_msg)
        if app_notify_callback:
            app_notify_callback(error_msg)
        return {file_path: None for file_path in files_to_post}

    logger.info(f"Starting AT Protocol posting process for {len(files_to_post)} files.")
    if app_notify_callback:
        app_notify_callback(
            f"Starting AT Protocol posting for {len(files_to_post)} files..."
        )

    # Load existing posts index
    posts_index = load_atproto_posts_index(index_file)

    for file_path in files_to_post:
        post_results[file_path] = None  # Default to failure

        try:
            logger.info(f"Processing for AT Protocol posting: {file_path.name}")

            # Get metadata from frontmatter
            import frontmatter

            try:
                with open(str(file_path), "r") as f:
                    post = frontmatter.load(f)

                # Get UUID and title if available, but don't require them
                file_uuid = str(post.get("uuid", ""))
                title = str(post.get("title", "Untitled"))
            except Exception as e:
                logger.warning(
                    f"Could not parse frontmatter for {file_path.name}: {str(e)}"
                )
                # Use fallback values if frontmatter fails
                file_uuid = ""
                title = file_path.name

            # Explicitly log the user text to be posted
            logger.info(f"DEBUGGING: Sending post with user_text: '{user_text}'")

            # Modified to include user text
            # Post to AT Protocol with the user-provided text
            post_url = await post_to_atproto(
                file_path, credentials, app_notify_callback, user_text
            )

            # Check if the returned URL looks like a test URL
            if post_url and "test" in post_url:
                logger.warning(
                    f"DEBUGGING: Returned URL contains 'test', suggesting TEST_MODE behavior: {post_url}"
                )

            if not post_url:
                error_msg = f"Failed to post {file_path.name} to AT Protocol."
                logger.error(error_msg)
                if app_notify_callback:
                    app_notify_callback(error_msg)
                continue

            # Update index
            post_results[file_path] = post_url

            # Only record in index if we have a UUID
            if file_uuid:
                # Record post in index
                timestamp = datetime.now(UTC).isoformat()

                # Update existing entry or create new one
                found_entry = False
                for item in posts_index:
                    if item.get("uuid") == file_uuid:
                        item["url"] = post_url
                        item["title"] = title
                        item["posted_at"] = timestamp
                        found_entry = True
                        logger.info(
                            f"Updated existing AT Protocol index entry for {file_uuid}"
                        )
                        break

                if not found_entry:
                    new_item = {
                        "uuid": file_uuid,
                        "title": title,
                        "url": post_url,
                        "posted_at": timestamp,
                    }
                    posts_index.append(new_item)
                    logger.info(f"Created new AT Protocol index entry for {file_uuid}")

                # Save index after each post
                if not save_atproto_posts_index(posts_index, index_file):
                    error_msg = f"Failed to save updated AT Protocol index after posting {file_path.name}!"
                    logger.error(error_msg)
                    if app_notify_callback:
                        app_notify_callback(error_msg)
            else:
                logger.info(f"No UUID found for {file_path.name}, not updating index")

            success_msg = f"Posted {file_path.name} to AT Protocol"
            if app_notify_callback:
                app_notify_callback(success_msg)

        except Exception as e:
            error_msg = f"Error processing {file_path.name} for AT Protocol: {str(e)}"
            logger.error(error_msg)
            if app_notify_callback:
                app_notify_callback(f"Error posting {file_path.name}")

    # Final summary
    completed_msg = f"AT Protocol posting process completed: {len([url for url in post_results.values() if url])} succeeded, {len([url for url in post_results.values() if not url])} failed."
    logger.info(completed_msg)
    if app_notify_callback:
        app_notify_callback(completed_msg)

    return post_results


def save_env_credentials_to_file(
    creds_file: Path = Path("data/atproto_credentials.json"),
) -> bool:
    """
    Save AT Protocol credentials from environment variables to a JSON file.

    This is useful for persisting environment variable credentials.

    Returns:
        bool: True if saved successfully, False otherwise.
    """
    bsky_user = os.environ.get("BSKY_USER")
    bsky_password = os.environ.get("BSKY_PASSWORD")

    if not bsky_user or not bsky_password:
        logger.warning(
            "Cannot save credentials: BSKY_USER and BSKY_PASSWORD environment variables not set"
        )
        return False

    credentials: ATProtoCredentials = {
        "handle": bsky_user,
        "email": bsky_user,  # Using handle/user as email
        "password": bsky_password,
    }

    return save_atproto_credentials(credentials, creds_file)


# --- AT Protocol CLI Utilities ---


async def check_bsky_cli_installed() -> Tuple[bool, str]:
    """
    Check if the bsky CLI is installed and accessible.

    Returns:
        Tuple[bool, str]: (is_installed, message)
    """
    try:
        proc = await asyncio.create_subprocess_exec(
            "bsky",
            "--version",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()

        if proc.returncode == 0:
            version = stdout.decode().strip()
            return True, f"bsky CLI is installed: {version}"
        else:
            return False, "bsky CLI is installed but returned an error"
    except FileNotFoundError:
        installation_guide = """
bsky CLI not found. To install:

1. Install Node.js (https://nodejs.org)
2. Run: npm install -g @atproto/cli
3. Run: bsky login
4. Follow the prompts to authenticate with your Bluesky account
"""
        return False, installation_guide
    except Exception as e:
        return False, f"Error checking bsky CLI: {str(e)}"
