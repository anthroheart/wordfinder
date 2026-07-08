document.addEventListener('DOMContentLoaded', () => {
    // --- Constants ---
    const VERSION = "v1.1 (Web SHA-256 + Yes/No)"; // Updated Version
    const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('');
    const NUMBERS = "0123456789".split('');
    const SYMBOLS_BASE = ",.-_#%+^?()*".split('');
    const SPACE = " "; // Important: Treat space separately if needed
    const SYMBOLS = [...SYMBOLS_BASE, SPACE]; // Combine base symbols and space
    const ALPHABET = [...LETTERS, ...NUMBERS, ...SYMBOLS]; // Full set if needed

    // --- DOM Elements ---
    const appTitle = document.getElementById('appTitle');
    const focusPhraseInput = document.getElementById('focusPhrase');
    const repetitionsInput = document.getElementById('repetitions');
    const hashLevelsInput = document.getElementById('hashLevels');
    const setFocusButton = document.getElementById('setFocusButton');
    const wordDisplay = document.getElementById('wordDisplay');
    const promptArea = document.getElementById('promptArea');
    const hashDisplay = document.getElementById('hashDisplay');
    const hashLabelA = document.getElementById('hashLabelA');
    const hashValueA = document.getElementById('hashValueA');
    const hashLabelB = document.getElementById('hashLabelB');
    const hashValueB = document.getElementById('hashValueB');
    const hashStatus = document.getElementById('hashStatus');
    const typeSelection = document.getElementById('typeSelection');
    const typeButtons = document.querySelectorAll('.type-button');
    const halfSelection = document.getElementById('halfSelection');
    const halfButtons = document.querySelectorAll('.half-button');
    const solvedButton = document.getElementById('solvedButton');
    const resultArea = document.getElementById('resultArea');
    const resultText = document.getElementById('resultText');
    const copyButton = document.getElementById('copyButton');

    // --- START: Added DOM Elements for Yes/No ---
    const yesNoSelection = document.getElementById('yesNoSelection');
    const yesButton = document.getElementById('yesButton');
    const yesHashDisplay = document.getElementById('yesHashDisplay');
    const noButton = document.getElementById('noButton');
    const noHashDisplay = document.getElementById('noHashDisplay');
    const yesNoHashStatus = document.getElementById('yesNoHashStatus');
    // --- END: Added DOM Elements for Yes/No ---

    // --- State Variables ---
    let focusPhrase = "";
    let repetitions = 888;
    let hashLevels = 888;
    let currentWord = [];
    let currentLetterIndex = 0;
    let currentRange = [];
    let currentType = null; // 'Letter', 'Number', 'Symbol'
    let isFinding = false; // Controls overall process flow
    let isHashing = false; // Prevents clicks during async hashing

    // Combine Yes/No buttons with other interactive buttons for disabling easily
    const interactiveButtons = [...typeButtons, ...halfButtons, yesButton, noButton, solvedButton ];

    // --- Initialization ---
    appTitle.textContent = `Web Word Finder w/MultiHashing`;
    resetState(); // Set initial UI state

    // --- Helper Functions ---
    function getOrdinal(n) {
        const num = n + 1;
        const s = ["th", "st", "nd", "rd"];
        const v = num % 100;
        return num + (s[(v - 20) % 10] || s[v] || s[0]);
    }

    function updateElementVisibility(element, show) {
        if (element) {
            element.classList.toggle('hidden', !show);
        }
    }

    function disableInputs(disabled) {
        focusPhraseInput.disabled = disabled;
        repetitionsInput.disabled = disabled;
        hashLevelsInput.disabled = disabled;
        setFocusButton.disabled = disabled;
    }

    // Updated disableButtons to accept an array
    function disableButtons(buttonArray, disabled) {
        buttonArray.forEach(button => button.disabled = disabled);
    }

    function updatePrompt(text) {
        promptArea.textContent = text;
        promptArea.classList.remove('hidden')
        updateElementVisibility(hashDisplay, false); // Hide hash display when showing general prompt
        // updateElementVisibility(yesNoSelection, false); // Also hide Yes/No hashes when showing general prompt (handled later)
    }

    function updateHashDisplay(labelA, hashA, labelB, hashB, status = "") {
         updateElementVisibility(promptArea, false) // Hide general prompt
         updateElementVisibility(hashDisplay, true);
         hashLabelA.textContent = labelA + ": ";
         hashValueA.textContent = hashA;
         hashLabelB.textContent = labelB + ": ";
         hashValueB.textContent = hashB;
         hashStatus.textContent = status;
         hashStatus.classList.toggle('hidden', !status);
    }

     // --- START: Added function to update Yes/No hash display ---
     function updateYesNoHashDisplay(yesHash, noHash, status = "") {
         yesHashDisplay.textContent = yesHash || '';
         noHashDisplay.textContent = noHash || '';
         yesNoHashStatus.textContent = status;
         yesNoHashStatus.classList.toggle('hidden', !status);
     }
     // --- END: Added function to update Yes/No hash display ---


    function updateWordDisplay() {
        const displayWord = currentWord.join(' '); // Show spaces between chars for clarity
        wordDisplay.textContent = `Word: ${displayWord || ""}`; // Handle empty word
        adjustWordDisplayFontSize();
    }

    function adjustWordDisplayFontSize() {
        const baseSize = 24; // px
        const minSize = 12; // px
        let currentSize = baseSize;
        wordDisplay.style.fontSize = `${currentSize}px`;
        const containerWidth = wordDisplay.offsetWidth;
        const scrollWidth = wordDisplay.scrollWidth;

        while (scrollWidth > containerWidth && currentSize > minSize) {
            currentSize -= 1;
            wordDisplay.style.fontSize = `${currentSize}px`;
            if (wordDisplay.scrollWidth <= containerWidth || currentSize <= minSize) break;
        }
    }

    // --- Hashing Functions (Client-Side SHA-256) ---
    async function sha256(str) {
        const buffer = new TextEncoder().encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    }

    async function multiHash(segment) {
        let currentHashInput = "";
        let hashValue = "Error"; // Default

        try {
            const localRepetitions = parseInt(repetitionsInput.value, 10) || 0;
            const localHashLevels = parseInt(hashLevelsInput.value, 10) || 0;

            if (localRepetitions <= 0 || localHashLevels < 0) {
                throw new Error("Repetitions must be > 0 and Levels >= 0.");
            }

            currentHashInput = segment.repeat(localRepetitions);
            hashValue = await sha256(currentHashInput);

            for (let i = 0; i < localHashLevels; i++) {
                 if (hashValue.length * localRepetitions > 50 * 1024 * 1024 ) {
                     console.warn(`Input for hash level ${i+1} potentially too large, skipping further levels.`);
                      throw new Error(`Hashing aborted: Input size limit exceeded at level ${i + 1}.`);
                 }
                currentHashInput = hashValue.repeat(localRepetitions);
                hashValue = await sha256(currentHashInput);
                 if (i % 50 === 0 && localHashLevels > 100) await new Promise(resolve => setTimeout(resolve, 0)); // Yield slightly more often on very long tasks
            }
        } catch (error) {
            console.error(`Hashing Error in multiHash for segment "${segment.substring(0, 50)}...":`, error); // Log segment start
            hashValue = "Error";
        }
        return hashValue;
    }

    // --- Core Logic Functions ---
    // --- START: Make setFocusPhrase async to await Yes/No hashing ---
    async function setFocusPhrase() {
    // --- END: Make setFocusPhrase async ---
        const phrase = focusPhraseInput.value.trim();
        const reps = parseInt(repetitionsInput.value, 10);
        const levels = parseInt(hashLevelsInput.value, 10);

        if (!phrase) {
            alert("Please Enter a Focus Phrase!");
            return;
        }
        if (isNaN(reps) || isNaN(levels) || reps <= 0 || levels < 0) {
            alert("Please Enter Valid Numbers for Repetitions (>0) and Levels (>=0)!");
            return;
        }

        focusPhrase = phrase;
        repetitions = reps;
        hashLevels = levels;
        isFinding = true;

        // Reset UI for new Search
        disableInputs(true);
        setFocusButton.disabled = true;
        updateElementVisibility(resultArea, false);
        updateElementVisibility(copyButton, false);
        updateElementVisibility(typeSelection, false);
        updateElementVisibility(yesNoSelection, false); // Hide yes/no initially
        updateElementVisibility(halfSelection, false);
        updateElementVisibility(hashDisplay, false);
        updateElementVisibility(solvedButton, false);
        updateYesNoHashDisplay("","",""); // Clear previous yes/no hashes

        currentWord = [];
        currentLetterIndex = 0;
        currentRange = [];
        currentType = null;
        isHashing = false; // Ensure hashing flag is reset

        wordDisplay.textContent = `Word: `;
        adjustWordDisplayFontSize();
        updatePrompt("Calculating initial Yes/No hashes..."); // Initial feedback

        // --- START: Calculate and Display Yes/No Hashes ---
        isHashing = true; // Set hashing flag for this initial phase
        let yesHash = "Error";
        let noHash = "Error";
        let yesNoError = false;
        const yesSegment = `'${focusPhrase}' IS Yes`;
        const noSegment = `'${focusPhrase}' IS No`;

        try {
            updateYesNoHashDisplay("Hashing...", "Hashing...", "Calculating...");
            //updateElementVisibility(yesNoSelection, true); // Show the section while hashing

            [yesHash, noHash] = await Promise.all([
                multiHash(yesSegment),
                multiHash(noSegment)
            ]);

            if (yesHash === "Error" || noHash === "Error") {
                updateYesNoHashDisplay(yesHash, noHash, "Error calculating Yes/No hashes. Try reducing repetitions or levels.");
                updateElementVisibility(yesNoSelection, true); // Show to display the error
                alert("Failed to calculate Yes/No hashes. Try reducing repetitions or levels and check console (F12).");
                resetState(true);
            } else {
                updateYesNoHashDisplay(yesHash, noHash, "Select Yes/No or Character Type:");
                updateElementVisibility(yesNoSelection, true); // Show Yes/No options immediately
            }
        } catch (error) {
            yesNoError = true;
            console.error("Error during Yes/No hash calculation:", error.message);
            updateYesNoHashDisplay("Error", "Error", `Error: ${error.message}. Try reducing repetitions or levels.`);
            updateElementVisibility(yesNoSelection, true);
            alert(`Yes/No hashing error: ${error.message}. Try reducing repetitions or levels.`);
            resetState(true);
        } finally {
             isHashing = false; // Clear hashing flag
        }

        if (yesNoError) {
            return; // Stop if Yes/No hashing failed
        }
        // --- END: Calculate and Display Yes/No Hashes ---

        // Start the character finding process *after* Yes/No hashes are ready
        startLetterTypeSelection(); // This will now *also* show the type buttons
    }


    function startLetterTypeSelection() {
        currentType = null;
        currentRange = [];
        const ordinal = getOrdinal(currentLetterIndex);
        // --- START: Conditional Logic for Yes/No ---
        if (currentLetterIndex === 0) {
            // First character: Offer Yes/No OR Type
            updatePrompt(`Is the answer YES or NO? (Check Hashes)\nOr, select the Type for the 1st Character:`);
            updateElementVisibility(typeSelection, true);
            updateElementVisibility(yesNoSelection, true); // Show Yes/No options
            updateYesNoHashDisplay(yesHashDisplay.textContent, noHashDisplay.textContent, "Select Yes/No, or the Character Type below:"); // Update status now
            disableButtons([yesButton, noButton, ...typeButtons], false); // Enable Yes/No and Type
        } else {
            // Subsequent characters: Only offer Type
            updatePrompt(`Select the Type for the ${ordinal} Character: Letter, Number, or Symbol?`);
            updateElementVisibility(typeSelection, true);
            updateElementVisibility(yesNoSelection, false); // Hide Yes/No options
            disableButtons([...typeButtons], false); // Enable only Type buttons
            disableButtons([yesButton, noButton], true); // Ensure Yes/No buttons are disabled
        }
        // --- END: Conditional Logic for Yes/No ---

        updateElementVisibility(halfSelection, false); // Hide half selection
        updateElementVisibility(solvedButton, true); // Show solved button
        disableButtons([...halfButtons], true); // Ensure half buttons are disabled initially
        solvedButton.disabled = false;
    }

    function chooseType(type) {
        if (isHashing) return;
        currentType = type;
        switch (type) {
            case 'Letter': currentRange = [...LETTERS]; break;
            case 'Number': currentRange = [...NUMBERS]; break;
            case 'Symbol': currentRange = [...SYMBOLS]; break;
            default: console.error("Invalid type:", type); return;
        }
        updateElementVisibility(typeSelection, false); // Hide type buttons after choice
        updateElementVisibility(yesNoSelection, false); // *** Ensure Yes/No is hidden when proceeding with characters ***
        processCurrentRange(); // Start the halving process for characters
    }

    function chooseHalf(choice /* 'first' or 'second' */) {
        if (isHashing || !currentRange || currentRange.length <= 1) return;

        const mid = Math.max(1, Math.floor(currentRange.length / 2));
        currentRange = (choice === 'first') ? currentRange.slice(0, mid) : currentRange.slice(mid);

        if (!currentRange.length) {
            console.error("Error: Range became empty after choosing half.");
            alert("Error: Cannot narrow down further. Resetting.");
            resetState(true); // Consider if full reset or just current letter reset is better
            return;
        }
        processCurrentRange();
    }

    // --- START: Dedicated function for choosing Yes/No ---
    function chooseYesNo(choice /* "Yes" or "No" */) {
        if (isHashing || currentLetterIndex !== 0) {
            console.warn("Attempted to choose Yes/No when not selecting the first character.");
            return;
        }
        
        console.log(`User chose: ${choice}`);
        currentWord = [choice]; // Set the word directly
        showWord(); // Trigger the completion sequence
    }
    // --- END: Dedicated function for choosing Yes/No ---


    async function processCurrentRange() {
        if (!isFinding) return;
        if (isHashing) {
             console.warn("processCurrentRange called while already hashing. Ignoring.");
             return;
        }

        // Disable all interactive buttons during hashing
        updateElementVisibility(typeSelection, false);
        updateElementVisibility(halfSelection, false);
        updateElementVisibility(yesNoSelection, false); // Hide Yes/No during char search
        disableButtons(interactiveButtons, true); // Disable ALL interactive buttons

        if (currentRange.length === 1) {
            isHashing = false; // Ensure flag is clear before proceeding
            const foundChar = currentRange[0];
            const displayChar = (foundChar === SPACE) ? "[SPACE]" : foundChar;
            console.log(`Character found: ${displayChar} (raw: ${foundChar})`);

            currentWord.push(displayChar);
            updateWordDisplay();

            const ordinal = getOrdinal(currentLetterIndex);
            updatePrompt(`Found the ${ordinal} Character ('${displayChar}')! Ready for the Next...`);
            updateElementVisibility(hashDisplay, false);

            currentLetterIndex++;
            console.log("Incremented letter index to:", currentLetterIndex);

            // Release button lock a bit earlier
            //disableButtons(interactiveButtons, false); // Re-enable buttons before pause
            //solvedButton.disabled = false; // Specifically ensure solved is enabled

            await new Promise(resolve => setTimeout(resolve, 1200));

            if (isFinding) {
                 startLetterTypeSelection(); // Start next character (will re-enable correct buttons)
            } else {
                 disableButtons(interactiveButtons, false); // Re-enable if process stopped here
                 console.log("Finding process stopped during pause.");
                 // Buttons are already re-enabled above, no need to call resetState here
            }

        } else if (currentRange.length > 1) {
            const mid = Math.max(1, Math.floor(currentRange.length / 2));
            const firstHalfChars = currentRange.slice(0, mid);
            const secondHalfChars = currentRange.slice(mid);
            const firstHalfDisplay = firstHalfChars.map(c => c === SPACE ? "[SPACE]" : c).join('');
            const secondHalfDisplay = secondHalfChars.map(c => c === SPACE ? "[SPACE]" : c).join('');
            const firstHalfStr = firstHalfChars.join('');
            const secondHalfStr = secondHalfChars.join('');

            const ordinal = getOrdinal(currentLetterIndex);
            const typeLower = currentType ? currentType.toLowerCase() : "character";

            const segmentA1 = `${ordinal} ${typeLower} of '${focusPhrase}' IS IN '${firstHalfStr}'`;
            const segmentA2 = `${ordinal} ${typeLower} of '${focusPhrase}' IS IN '${secondHalfStr}'`;

            updateHashDisplay(firstHalfDisplay, "Hashing...", secondHalfDisplay, "Hashing...", "Calculating Hashes...");
            isHashing = true; // Set flag *before* await
            let hashA1 = "Error", hashA2 = "Error";

            try {
                [hashA1, hashA2] = await Promise.all([
                    multiHash(segmentA1),
                    multiHash(segmentA2)
                ]);

                isHashing = false; // Clear flag *after* await

                if (!isFinding) {
                     // Renable buttons if aborted during hash
                     disableButtons(interactiveButtons, false);
                     return;
                }
                if (hashA1 === "Error" || hashA2 === "Error") {
                    updateHashDisplay(firstHalfDisplay, hashA1, secondHalfDisplay, hashA2, "Hashing failed. Try reducing repetitions or levels.");
                    alert("Hashing failed for segments. Try reducing repetitions or levels and check console (F12).");
                    disableButtons(interactiveButtons, false);
                    return;
                }

                // Success! Update display and enable *only* half buttons and solved
                updateHashDisplay(firstHalfDisplay, hashA1, secondHalfDisplay, hashA2, `Select the group containing the ${ordinal} ${typeLower}:`);
                updateElementVisibility(halfSelection, true);
                disableButtons([yesButton, noButton, ...typeButtons], true); // Keep type/yes-no disabled
                disableButtons([...halfButtons, solvedButton], false); // Enable halfs + solved

            } catch (error) {
                isHashing = false;
                disableButtons(interactiveButtons, false);
                console.error("Error during parallel hash processing:", error.message);
                updateHashDisplay(firstHalfDisplay, "Error", secondHalfDisplay, "Error", `Error: ${error.message}. Try reducing repetitions or levels.`);
                alert(`Hashing error: ${error.message}. Try reducing repetitions or levels.`);
            }

        } else {
             isHashing = false; // Clear flag
             disableButtons(interactiveButtons, false); // Re-enable buttons
             console.error("Error: Current range has invalid length:", currentRange.length);
             alert("Logic error: Character range is invalid. Resetting.");
             resetState(true);
        }
    }

    function showWord() {
        isFinding = false; // Stop the finding process

        if (!focusPhrase) {
             updatePrompt("Please set a focus phrase first.");
             resetState();
             return;
        }
         if (currentWord.length === 0) {
             updatePrompt("No characters/choice selected. Ready for next phrase.");
             // Reset UI for next run, but don't show result area
             currentWord = [];
             currentLetterIndex = 0;
             disableInputs(false);
             setFocusButton.disabled = false;
             updateElementVisibility(typeSelection, false);
             updateElementVisibility(yesNoSelection, false); // Hide Yes/No
             updateElementVisibility(halfSelection, false);
             updateElementVisibility(solvedButton, false);
             updateElementVisibility(resultArea, false);
             updateElementVisibility(copyButton, false);
             updateElementVisibility(hashDisplay, false);
             wordDisplay.textContent = `Word: `;
             adjustWordDisplayFontSize();
             updateYesNoHashDisplay("","",""); // Clear yes/no hashes
             return;
         }

        // Display Result
        // Check if the result is Yes/No or standard characters
        const finalWord = (currentWord.length === 1 && (currentWord[0] === 'Yes' || currentWord[0] === 'No'))
             ? currentWord[0] // Use Yes/No directly
             : currentWord.map(c => (c === "[SPACE]") ? SPACE : c).join(''); // Join chars

        resultText.textContent = `Result: ${finalWord}`;
        updateElementVisibility(resultArea, true);
        updateElementVisibility(copyButton, true);
        copyToClipboard(finalWord); // Optional: auto-copy

        // Prepare for Next Run
        updatePrompt("Word finding complete! Ready for next phrase.");
        wordDisplay.textContent = `Word: `;
        adjustWordDisplayFontSize();
        updateElementVisibility(hashDisplay, false);
        updateElementVisibility(typeSelection, false);
        updateElementVisibility(halfSelection, false);
        updateElementVisibility(solvedButton, false);
        updateElementVisibility(yesNoSelection, false); // Hide Yes/No section
        disableInputs(false);
        setFocusButton.disabled = false;

        // Clear state for next run
        currentWord = [];
        currentLetterIndex = 0;
        currentRange = [];
        currentType = null;
        // isFinding is already false
        isHashing = false;
        updateYesNoHashDisplay("","",""); // Clear yes/no hashes
    }


    async function copyToClipboard(text) {
         if (!navigator.clipboard) {
            alert('Clipboard API not available.');
            return;
        }
        try {
            await navigator.clipboard.writeText(text);
             const originalText = copyButton.textContent;
             copyButton.textContent = "Copied!";
             setTimeout(() => { copyButton.textContent = originalText; }, 1500);
        } catch (err) {
            console.error('Failed to copy: ', err);
            alert('Failed to copy word.');
        }
    }


    function resetState(forceFullClear = false) { // Add optional flag if needed
        currentWord = [];
        currentLetterIndex = 0;
        currentRange = [];
        currentType = null;
        isFinding = false;
        isHashing = false;
        if (forceFullClear) { // Optionally clear phrase/settings too
             focusPhraseInput.value = "";
             // repetitionsInput.value = 888; // Or keep last values?
             // hashLevelsInput.value = 888;
             focusPhrase = "";
        }

        wordDisplay.textContent = `Word: `;
        adjustWordDisplayFontSize();
        updatePrompt("Modify Focus Phrase/Settings if needed, then click 'Set Focus Phrase'.");

        disableInputs(false);
        setFocusButton.disabled = false;

        updateElementVisibility(typeSelection, false);
        updateElementVisibility(halfSelection, false);
        updateElementVisibility(solvedButton, false);
        updateElementVisibility(resultArea, false);
        updateElementVisibility(copyButton, false);
        updateElementVisibility(hashDisplay, false);
        updateElementVisibility(yesNoSelection, false); // Hide Yes/No section
        updateYesNoHashDisplay("","",""); // Clear Yes/No hashes

        disableButtons(interactiveButtons, true); // Disable all potentially interactive buttons initially
        setFocusButton.disabled = false; // Re-enable set focus specifically
    }


    // --- Event Listeners ---
    setFocusButton.addEventListener('click', setFocusPhrase); // Now potentially async

    typeButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (!button.disabled) { // Check if button is enabled
                chooseType(button.dataset.type);
            }
        });
    });

    halfButtons.forEach(button => {
        button.addEventListener('click', () => {
             if (!button.disabled) { // Check if button is enabled
                chooseHalf(button.dataset.choice);
             }
        });
    });

    // --- START: Added Event Listeners for Yes/No Buttons ---
    yesButton.addEventListener('click', () => {
        if (!yesButton.disabled) { // Check if button is enabled
             chooseYesNo('Yes');
        }
    });

    noButton.addEventListener('click', () => {
        if (!noButton.disabled) { // Check if button is enabled
             chooseYesNo('No');
        }
    });
    // --- END: Added Event Listeners for Yes/No Buttons ---


    solvedButton.addEventListener('click', () => {
        if (!solvedButton.disabled) { // Check if button is enabled
             showWord();
        }
    });

    copyButton.addEventListener('click', () => {
        const textContent = resultText.textContent || "";
        const textToCopy = textContent.replace(/^Result:\s*/, '');
        if (textToCopy) {
           copyToClipboard(textToCopy);
        }
   });


}); // End DOMContentLoaded