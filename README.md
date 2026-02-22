# ✿ Sakura Sonata
### **Team: Hungry Hippos** | **Event: HackED 2026**

An AI-powered music visualization engine that transforms static MIDI files and live keyboard performances into a blooming, high-fidelity experience.

<p align="center">
  <img src="https://github.com/user-attachments/assets/03792325-0545-418b-90d7-b9c269214634" width="100%" alt="Sakura Sonata">
  <br>
  <em>The "Sakura Sonata" Visualizer in action — where music meets aesthetic.</em>
</p>

## ✦ Inspiration
Digital music files can feel like invisible data. We wanted to bridge the gap between these static MIDI files and the vibrant, rhythmic energy of a live performance. We took the elegance of Japanese aesthetics and the soul of a piano sonata to create **Sakura Sonata**—a platform where your digital music doesn't just get played, it blooms.

## ✿ What it does
* **The Upload & Live Studio:** Users can drop MIDI files into a dreamy, aesthetic beige (#FFF6EB) interface designed for a calm, creative experience, or **connect an actual MIDI keyboard via USB to play live.**
* **The AI Sensei:** Our backend parses complex musical data to identify pitches, durations, and tempo with high precision, while also providing intelligent AI feedback on your performance and composition. It even automatically extracts deep metadata like key signatures, time signatures, and exact note counts!
* **The Visualizer & Practice Modes:** Instead of boring bars, the app generates a high-fidelity visualization with labeled falling notes (e.g., C4, G4) so users can easily follow along. Users can seamlessly toggle between "Falling Notes", "Audio Player", and a dedicated "Practice" mode.
* **Speed Control & Custom Audio:** To make learning easier, users can adjust the playback speed anywhere from 0.1x to 2x without distorting the pitch. They can also change and customize the tone of the piano sounds (like "Splendid Grand") directly within the studio.

## 🛠 How we built it
We utilized a sophisticated, type-safe stack to ensure every note is captured with precision:
* **Framework:** Next.js 14 with the App Router for seamless page transitions.
* **Frontend:** TypeScript for a rock-solid codebase that handles complex musical JSON structures.
* **Styling:** Tailwind CSS for the "Sakura-Aesthetic"—heavy on #FFF6EB beige backgrounds, soft pinks, and clean dark navy accents.
* **Backend/Database:** Supabase for lightning-fast Google Authentication, PostgreSQL data persistence, and MIDI file storage.
* **Motion:** Framer Motion to power the signature falling sakura petals and the "blooming" transitions between the dashboard and the arena.

## 🌊 Challenges we ran into
* **The Live Hardware Bridge (USB MIDI):** Connecting a physical keyboard to a web application is rarely plug-and-play. We had to dive deep into the Web MIDI API to parse raw hardware signals into usable data for our visualizer. Ensuring that velocity, "note-on," and "note-off" events from the user's keyboard registered in the browser with zero perceived latency was a massive technical hurdle.
* **Audio Engine & Custom Tones:** Implementing the ability to change piano tones dynamically required managing multiple audio buffers. We had to optimize the audio engine so that switching from a standard grand piano to a different tone didn't cause audio clipping, memory leaks, or lag—especially when playing fast, complex chords.
* **Real-Time AI Feedback:** Generating meaningful AI feedback on a user's performance meant we had to analyze rhythm and pitch accuracy on the fly. Balancing this heavy data processing in the background without causing the main visualizer thread to drop frames was a tough lesson in state management and performance optimization.
* **The Responsive Arena (Minimize/Maximize):** We wanted the UI to be fluid, allowing users to minimize the visualizer to a dashboard view or maximize it for full immersion. Keeping the Framer Motion physics smooth—ensuring hundreds of falling petals didn't break or jump erratically when the browser DOM dynamically resized—required intense mathematical mapping and responsive design logic.

## 🌸 Accomplishments that we're proud of
* **Live Hardware Integration:** Successfully bridging the gap between physical instruments and the web browser. We are incredibly proud of achieving zero-latency USB MIDI connectivity, allowing users to play an actual keyboard and instantly see their notes bloom on screen.
* **The "AI Sensei" Feedback System:** We didn't just build a visualizer; we built an interactive tutor. We successfully integrated an AI layer that analyzes a user's live performance and composition data to provide meaningful, actionable feedback.
* **Dynamic Audio Engine:** Engineering a robust custom audio system that lets users seamlessly switch piano tones on the fly. Doing this without breaking the app's performance or causing audio clipping makes the studio feel like a professional tool.
* **Fluid & Responsive Visualizer:** Designing a complex Framer Motion layout that gracefully handles minimizing to a dashboard view or maximizing to full-screen. The falling petals and visualizer physics adjust dynamically without losing their beautiful, dreamy aesthetic.
* **Production-Ready Full Stack:** Delivering a complete, polished product in a hackathon timeframe. From secure Google Auth and drag-and-drop file parsing to a dynamic Supabase library that stores user sonatas, the app feels premium from end to end.

## 📖 What we learned
Building Sakura Sonata taught us that AI is most powerful when used to enhance human creativity and emotion. Technically, we learned how to bridge the gap between physical hardware and web applications using the Web MIDI API, and how to manage complex audio buffers for real-time instrument switching. We also learned how to manage real-time data streams—transforming raw MIDI and live keyboard inputs into a fluid visual experience—and how to architect a backend that securely persists a user's musical library. Most importantly, we discovered that the "technical" part of a project (the code) and the "soul" (the aesthetic) must work in perfect harmony.

## ✿ What's next for Sakura Sonata
* **The "AI Sensei" Vision (OMR):** We plan to train a custom Computer Vision model (OMR) to read and transcribe physical sheet music (PDF, PNG). Users will be able to snap a photo of a handwritten score and see it bloom into a digital performance.
* **Ensemble Mode:** AI transcription and visualization for multi-instrumental sheets like violin and cello duets.
* **Global Concert Hall:** A gallery where users can share their "Sonata Videos" with the world.

## 🏗 Built With
* Next.js
* TypeScript
* Tailwind CSS
* Supabase
* Framer Motion
