# Neural Sync: Hand Tracking Cyberpunk Game

Neural Sync is a web-based, webcam-powered interactive gaming experience powered by MediaPipe Hand Tracking. It features a futuristic cyberpunk aesthetic and allows players to control gameplay using real-time hand movements.

## Features

*   **Hand Tracking Control:** Uses your webcam and AI-based hand tracking to map your hand movements directly to the game cursor.
*   **Gesture Recognition:** 
    *   **Open Hand:** Move the cursor fluidly around the screen.
    *   **Clenched Fist:** Used as an action trigger to return to the menu or restart the game.
*   **Two Game Modes:**
    *   **Neural Dodge (Mode_01):** A high-speed evasion test where you must dodge incoming red fragments. As you survive longer, the game progressively speeds up and enemies track your position.
    *   **Maze Crawler (Mode_02):** A precision navigation task. Guide your cursor through procedurally generated mazes to reach the exit node, but avoid touching the walls.
*   **Difficulty Scaling:** Select between Easy, Normal, and Hard to adjust the speed of the dodge mode and the complexity of the generated mazes.
*   **Cyberpunk Aesthetic:** Features vector-like graphics, glitch effects, neon colors, and dynamic UI elements built with styled HTML and Canvas.
*   **Power-ups:** Collect occasional power-ups in Dodge mode (like slow-motion or shields) to increase your chance of survival.

## How to Play

1. **Allow Webcam Access:** When the app loads, ensure you grant camera permissions. This is required for the hand tracking AI to function.
2. **Optimal Environment:** Ensure your environment has good lighting and keep your hand clearly visible within the camera's frame.
3. **Menu interface:** 
    *   **Select Game Mode:** Click on either "Neural Dodge" or "Maze Crawler" with your mouse.
    *   **Select Difficulty:** Click on Easy, Normal, or Hard at the bottom of the interface.
4. **Gameplay:**
    *   Once the game begins, use your open hand in front of the camera to move.
    *   **Neural Dodge:** Avoid the falling red boxes. Survive as long as possible to increase your score and level.
    *   **Maze Crawler:** Carefully guide the blue dot through the white maze corridors to the green exit area. Touching walls results in an immediate game over.
5. **Restarting:** When you get a Game Over, you can either click the restart button on the screen, or simply **clench your fist** to instantly restart the current game mode.

## Technologies Used

*   [React](https://reactjs.org/) - User Interface and UI state management
*   [Vite](https://vitejs.dev/) - Lightning-fast frontend build tool
*   [Tailwind CSS](https://tailwindcss.com/) - Utility-first styling for the futuristic UI
*   [Framer Motion](https://www.framer.com/motion/) - UI animations and menu transitions
*   [MediaPipe Tasks Vision](https://developers.google.com/mediapipe) - Google's on-device AI framework for real-time hand landmark detection
*   **HTML5 Canvas** - For rendering high-performance game logic, particles, enemies, and mazes

## Installation & Development

To run this project locally:

1. Clone this repository.
2. Install the necessary dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Open the provided `localhost` URL in your web browser.

## Privacy Note

All hand tracking operations are processed completely client-side in your web browser using WebAssembly. No video feed, images, or personal data is transmitted to any external servers.
