import asyncio
import json
import logging
import os
import re
import shutil
from datetime import datetime, UTC
from pathlib import Path
from typing import Dict, List, Optional, TypedDict, cast, Callable, Any

import frontmatter

# Constants
DEFAULT_TAGS = [
    {"name": "Content-Type", "value": "text/markdown"},
    {"name": "App-Name", "value": "Quartz-Notes"},
]

# Test mode - set to True to skip actual uploads but simulate the process
TEST_MODE = False  # TODO: Consider making this configurable externally


# Types (Consider moving to a shared types file if more modules need them)
class ArweaveTag(TypedDict):
    name: str
    value: str


class ArweaveHash(TypedDict):
    hash: str
    timestamp: str
    link: str
    # tags: List[ArweaveTag] # Tags are not stored in archive.json


# Global logger - assumes logger is configured in the main app
# Alternatively, initialize a specific logger for this module
logger = logging.getLogger("jasper.arweave")

# --- Arweave Data Handling ---


def load_arweave_index(index_file: Path = Path("data/archive.json")) -> List[Dict]:
    """Load Arweave index data from the JSON file."""
    try:
        if not index_file.exists():
            logger.warning(
                f"Archive file not found at {index_file}, returning empty list."
            )
            return []

        with open(index_file, "r") as f:
            archive_content = f.read()
            # Check for and fix common JSON issues like trailing commas
            archive_content = re.sub(r",\s*}", "}", archive_content)
            archive_content = re.sub(r",\s*]", "]", archive_content)
            data = json.loads(archive_content)

            if not isinstance(data, dict) or "files" not in data:
                logger.warning(
                    f"Archive {index_file} has invalid structure, returning empty list."
                )
                return []

            if not isinstance(data["files"], list):
                logger.error(f"Archive {index_file} 'files' key is not a list.")
                return []

            logger.info(f"Loaded {len(data['files'])} entries from {index_file}")
            return data.get("files", [])

    except Exception as e:
        logger.error(f"Error loading archive file {index_file}: {str(e)}")
        return []


def save_arweave_index(
    index_data: List[Dict], index_file: Path = Path("data/archive.json")
) -> bool:
    """Save Arweave index data to the JSON file."""
    archive_data = {"files": index_data}

    # Ensure parent directory exists
    index_file.parent.mkdir(parents=True, exist_ok=True)

    # Create backup before writing
    backup_file = index_file.with_suffix(".json.bak")
    if index_file.exists():
        try:
            shutil.copy2(index_file, backup_file)
            logger.info(f"Created backup of archive at {backup_file}")
        except Exception as e:
            logger.warning(f"Failed to create archive backup: {e}")

    try:
        # Write to a temporary file first
        temp_file = index_file.with_suffix(".tmp")
        with open(temp_file, "w") as f:
            json.dump(archive_data, f, indent=2)

        # Atomically replace the actual file
        os.replace(temp_file, index_file)
        logger.info(f"Successfully saved {len(index_data)} entries to {index_file}")
        return True

    except Exception as e:
        logger.error(f"Error saving archive file {index_file}: {e}")
        # Attempt to restore from backup on failure
        if backup_file.exists():
            try:
                shutil.copy2(backup_file, index_file)
                logger.info(
                    f"Restored archive from backup {backup_file} after save error."
                )
            except Exception as restore_error:
                logger.error(f"Failed to restore archive from backup: {restore_error}")
        return False


def get_arweave_status(
    uuid_value: str,
    index_data: Optional[List[Dict]] = None,
    index_file: Path = Path("data/archive.json"),
) -> str:
    """Check the upload status of a file based on its UUID in the index."""
    if uuid_value == "N/A" or not uuid_value:
        return "No UUID found"

    if index_data is None:
        index_data = load_arweave_index(index_file)

    if not index_data:  # Handles case where index couldn't be loaded or is empty
        return "Not uploaded (archive not found or empty)"

    for item in index_data:
        if item.get("uuid") == uuid_value:
            hash_count = len(item.get("arweave_hashes", []))
            if hash_count > 0:
                return (
                    f"Uploaded ({hash_count} version{'' if hash_count == 1 else 's'})"
                )
            else:
                return "Tracked in archive, but no uploads recorded"  # Should ideally not happen

    return "Not uploaded"


def _find_wallet_path() -> Optional[str]:
    """Find the Arweave wallet file path."""
    # Check environment variable first
    wallet_path = os.environ.get("ARWEAVE_WALLET_PATH")
    if wallet_path and Path(wallet_path).exists():
        logger.info(f"Using wallet from ARWEAVE_WALLET_PATH: {wallet_path}")
        return wallet_path

    # Try default locations, prioritizing .wallet.json in current directory
    default_paths = [
        Path(".wallet.json"),  # Current directory (new primary location)
        Path("jasper/.wallet.json"),  # Jasper directory
        Path.home() / ".config" / "arkb" / "wallet.json",  # System-wide fallback
    ]

    # Log all attempted paths for debugging
    for path in default_paths:
        abs_path = path.resolve()
        if abs_path.exists():
            logger.info(f"Found wallet at: {abs_path}")
            return str(abs_path)
        else:
            logger.debug(f"Tried wallet path (not found): {abs_path}")

    logger.warning(
        "No Arweave wallet file found in environment variable or default locations."
    )
    return None


# --- Arweave CLI Interactions ---


async def get_wallet_balance(wallet_path: Optional[str] = None) -> float:
    """Get current Arweave wallet balance using arkb."""
    if wallet_path is None:
        wallet_path = _find_wallet_path()

    if not wallet_path:
        logger.error("Cannot get balance: Arweave wallet path not found.")
        return 0.0

    try:
        proc = await asyncio.create_subprocess_exec(
            "arkb",
            "balance",
            "--wallet",
            wallet_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()

        if proc.returncode != 0:
            stderr_decoded = stderr.decode().strip()
            logger.error(
                f"'arkb balance' failed (code {proc.returncode}): {stderr_decoded}"
            )
            return 0.0

        balance_str = stdout.decode().strip()
        match = re.search(r"AR\s+(\d+\.\d+)", balance_str)
        if match:
            balance = float(match.group(1))
            logger.info(f"Wallet balance: {balance:.6f} AR")
            return balance
        else:
            logger.error(
                f"Could not parse balance from 'arkb balance' output: {balance_str}"
            )
            return 0.0

    except FileNotFoundError:
        logger.error(
            "'arkb' command not found. Please ensure Arweave Wallet Kit is installed and in PATH."
        )
        return 0.0
    except Exception as e:
        logger.error(f"Error checking wallet balance: {str(e)}")
        return 0.0


async def estimate_upload_cost(
    file_path: Path, wallet_path: Optional[str] = None
) -> float:
    """Estimate upload cost for a file using arkb (or fallback)."""
    if not file_path.exists():
        logger.error(f"Cannot estimate cost: File not found at {file_path}")
        return 0.0

    # Fallback: Use size-based heuristic as arkb cost/price is unreliable
    # TODO: Revisit using 'arkb price <bytes>' if it becomes stable
    try:
        file_size = file_path.stat().st_size
        # Simple heuristic: 0.000001 AR per KB (adjust as needed)
        estimated_cost = (file_size / 1024) * 0.000001
        logger.info(
            f"Estimated cost for {file_path.name}: {estimated_cost:.6f} AR (size-based heuristic)"
        )
        return estimated_cost

    except Exception as e:
        logger.error(f"Error estimating upload cost for {file_path.name}: {str(e)}")
        return 0.0


async def _execute_arkb_deploy(
    file_path: Path, tags: List[Dict[str, str]], wallet_path: str
) -> Optional[str]:
    """Internal function to execute the arkb deploy command and parse TX ID."""
    tag_args = []
    for tag in tags:
        tag_args.extend(["--tag", f"{tag['name']}:{tag['value']}"])

    # Use --no-bundle for direct uploads, --auto-confirm to skip prompt
    cmd = [
        "arkb",
        "deploy",
        str(file_path),
        "--wallet",
        wallet_path,
        *tag_args,
        "--no-bundle",
        "--auto-confirm",
    ]
    logger.info(f"Executing command: {' '.join(cmd)}")

    try:
        process = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )
        stdout_data, stderr_data = await process.communicate()
        stdout_text = stdout_data.decode("utf-8")
        stderr_text = stderr_data.decode("utf-8")

        # Log relevant output (simplified logging)
        logger.debug(f"arkb deploy stdout for {file_path.name}:\n{stdout_text}")
        if stderr_text.strip():
            # Log warnings/errors differently
            log_level = logging.ERROR if process.returncode != 0 else logging.WARNING
            logger.log(
                log_level, f"arkb deploy stderr for {file_path.name}:\n{stderr_text}"
            )

        if process.returncode != 0:
            logger.error(
                f"'arkb deploy' for {file_path.name} failed (code {process.returncode})."
            )
            # Provide more context if possible from stderr
            if "insufficient funds" in stderr_text.lower():
                logger.error("Reason likely insufficient funds.")
            return None

        # Extract transaction ID (robust parsing)
        tx_id = None
        # 1. URL pattern
        url_match = re.search(r"https://arweave\.net/([a-zA-Z0-9_-]{43})", stdout_text)
        if url_match:
            tx_id = url_match.group(1)
            logger.info(f"Extracted TX ID (URL): {tx_id}")
        else:
            # 2. Look for 43-char Base64URL strings (standard Arweave TX ID format)
            # This is safer than looking for specific table formats or labels
            potential_ids = re.findall(r"\b([a-zA-Z0-9_-]{43})\b", stdout_text)
            if potential_ids:
                # Often the last one is the final TX ID, but check context if needed
                tx_id = potential_ids[-1]
                logger.info(f"Extracted TX ID (43-char pattern): {tx_id}")
            else:
                logger.error(
                    f"Could not extract Arweave TX ID from 'arkb deploy' output for {file_path.name}."
                )
                return None

        logger.info(f"Successfully deployed {file_path.name}, TX ID: {tx_id}")
        logger.info(f"View at: https://www.arweave.net/{tx_id}")
        return tx_id

    except FileNotFoundError:
        logger.error(
            "'arkb' command not found. Please ensure Arweave Wallet Kit is installed and in PATH."
        )
        return None
    except Exception as e:
        logger.error(f"Error executing 'arkb deploy' for {file_path.name}: {e}")
        return None


async def upload_to_arweave(
    file_path: Path, tags: List[Dict[str, str]], wallet_path: Optional[str] = None
) -> Optional[str]:
    """Upload a single file to Arweave using arkb."""
    if TEST_MODE:
        logger.info(f"TEST MODE: Simulating Arweave upload for {file_path.name}")
        await asyncio.sleep(0.5)
        # Generate a fake but valid-looking TX ID for testing purposes
        fake_tx_id = "".join(
            random.choices(
                "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_", k=43
            )
        )
        logger.info(f"TEST MODE: Simulated TX ID: {fake_tx_id}")
        return fake_tx_id

    if wallet_path is None:
        wallet_path = _find_wallet_path()

    if not wallet_path:
        logger.error(f"Cannot upload {file_path.name}: Arweave wallet path not found.")
        return None

    # Log before execution
    logger.info(f"Attempting Arweave upload for {file_path} with tags: {tags}")

    tx_id = await _execute_arkb_deploy(file_path, tags, wallet_path)
    return tx_id


# --- Main Upload Orchestration ---


async def upload_files_to_arweave(
    files_to_upload: List[Path],
    app_notify_callback: Optional[Callable[[str], None]] = None,
    index_file: Path = Path("data/archive.json"),
) -> Dict[Path, Optional[str]]:
    """
    Uploads a list of files to Arweave, updates the index, and returns status.

    Args:
        files_to_upload: List of file paths to upload.
        app_notify_callback: Optional callback for UI notifications.
        index_file: Path to the Arweave index JSON file.

    Returns:
        A dictionary mapping file paths to their resulting Arweave TX ID (or None if failed).
    """
    upload_results: Dict[Path, Optional[str]] = {}

    if not files_to_upload:
        logger.info("No files provided for Arweave upload.")
        return upload_results

    wallet_path = _find_wallet_path()
    if not wallet_path and not TEST_MODE:
        error_msg = "Arweave upload cannot proceed: Wallet path not found."
        logger.error(error_msg)
        if app_notify_callback:
            app_notify_callback(error_msg)
        return {file_path: None for file_path in files_to_upload}

    logger.info(f"Starting Arweave upload process for {len(files_to_upload)} files.")
    if app_notify_callback:
        app_notify_callback(
            f"Starting Arweave upload for {len(files_to_upload)} files..."
        )

    index_data = load_arweave_index(index_file)
    original_index_data = [item.copy() for item in index_data]

    for file_path in files_to_upload:
        upload_results[file_path] = None
        try:
            logger.info(f"Processing for Arweave upload: {file_path.name}")

            # Get metadata from frontmatter
            with open(str(file_path), "r") as f:
                post = frontmatter.load(f)

            file_uuid = str(post.get("uuid", ""))
            title = str(post.get("title", "Untitled"))
            file_type = str(post.get("type", ""))

            if not file_uuid:
                error_msg = f"Skipping {file_path.name}: No UUID found in frontmatter."
                logger.error(error_msg)
                if app_notify_callback:
                    app_notify_callback(error_msg)
                continue

            # Prepare Arweave tags
            tags = DEFAULT_TAGS.copy()
            tags.append({"name": "UUID", "value": file_uuid})
            if file_type:
                tags.append({"name": "Type", "value": file_type})

            # Perform the upload
            tx_id = await upload_to_arweave(file_path, tags, wallet_path)

            if not tx_id:
                error_msg = f"Failed to upload {file_path.name} to Arweave."
                logger.error(error_msg)
                if app_notify_callback:
                    app_notify_callback(error_msg)
                continue

            # Update index
            upload_results[file_path] = tx_id

            timestamp = datetime.now(UTC).isoformat()
            arweave_hash_entry: ArweaveHash = {
                "hash": tx_id,
                "timestamp": timestamp,
                "link": f"https://www.arweave.net/{tx_id}",
            }

            found_entry = False
            for item in index_data:
                if item.get("uuid") == file_uuid:
                    if "arweave_hashes" not in item or not isinstance(
                        item["arweave_hashes"], list
                    ):
                        item["arweave_hashes"] = []
                    item["arweave_hashes"].append(arweave_hash_entry)
                    item["title"] = title
                    found_entry = True
                    logger.info(f"Updated existing Arweave index entry for {file_uuid}")
                    break

            if not found_entry:
                new_item = {
                    "uuid": file_uuid,
                    "title": title,
                    "arweave_hashes": [arweave_hash_entry],
                }
                index_data.append(new_item)
                logger.info(f"Created new Arweave index entry for {file_uuid}")

            if not save_arweave_index(index_data, index_file):
                error_msg = f"Critical: Failed to save updated Arweave index after uploading {file_path.name}!"
                logger.error(error_msg)
                if app_notify_callback:
                    app_notify_callback(error_msg)

            success_msg = f"Uploaded {file_path.name}: {tx_id[:10]}..."
            if app_notify_callback:
                app_notify_callback(success_msg)

        except Exception as e:
            error_msg = f"Error processing {file_path.name}: {str(e)}"
            logger.error(error_msg)
            if app_notify_callback:
                app_notify_callback(f"Error uploading {file_path.name}")

    completed_msg = f"Arweave upload process completed. Results: { {fp.name: txid[:6]+'...' if txid else 'Failed' for fp, txid in upload_results.items()} }"
    logger.info(completed_msg)
    if app_notify_callback:
        success_count = sum(1 for txid in upload_results.values() if txid)
        fail_count = len(files_to_upload) - success_count
        summary_msg = (
            f"Arweave upload finished: {success_count} succeeded, {fail_count} failed."
        )
        app_notify_callback(summary_msg)

    return upload_results


# --- Utility imports needed for TEST_MODE ---
import random
