# ✿ Sakura Sonata 
### **Team: Hungry Hippos** ### **Event: HackED 2026**

An AI-powered music visualization engine that transforms static MIDI and audio files into a blooming, high-fidelity performance.

![Video_Generation_for_Hungry_Hippos (1)](https://github.com/user-attachments/assets/a508fc59-2267-4e23-94e5-aae2d142d0d3)

## ✦ Inspiration
Digital music files can feel like invisible data. We wanted to bridge the gap between these static MIDI files and the vibrant, rhythmic energy of a live performance. We took the elegance of Japanese aesthetics and the soul of a piano sonata to create Sakura Sonata—a platform where your digital music doesn't just get played, it blooms.

## ✿ What it does
* **The Upload:** Users drop audio or MIDI files into a dreamy, **aesthetic beige (#FFF6EB)** interface designed for a calm, creative experience.
* **The AI Sensei:** Our backend parses complex musical data to identify pitches, durations, and tempo with high precision.
* **The Visualizer:** Instead of boring bars, the app generates a high-fidelity visualization where **falling sakura petals** hit piano keys in real-time.

## 🛠 How we built it
We utilized a sophisticated, type-safe stack to ensure every note is captured with precision:
* **Framework:** Next.js 14 with the App Router for seamless page transitions.
* **Frontend:** TypeScript for a rock-solid codebase that handles complex musical JSON structures.
* **Styling:** Tailwind CSS for the "Sakura-Aesthetic"—heavy on **#FFF6EB beige backgrounds**, soft pinks, and clean dark navy accents.
* **Backend/Database:** **Supabase** for lightning-fast Google Authentication, PostgreSQL data persistence, and MIDI file storage.
* **Motion:** Framer Motion to power the signature falling sakura petals and the "blooming" transitions between the dashboard and the arena.

## 🌊 Challenges we ran into
* **The Synchronization Barrier:** Turning a MIDI file into a "dreamy performance paradox" was our biggest hurdle. It wasn't just about playing the notes; it was about ensuring the sakura petal particles hit the piano keys at the exact millisecond the MIDI data triggered the sound.
* **The Precision Challenge:** A single millisecond of lag could turn a beautiful sonata into a visual mess. We optimized the rendering engine to handle hundreds of falling "note-petals" simultaneously without dropping frames.
* **UI Consistency:** Ensuring the `Sidebar.tsx` and main Dashboard felt like one cohesive space while transitioning into the visualizer required careful management of transparency and backdrop blurs.

## 🌸 Accomplishments that we're proud of
* **The Sakura Storm Visualizer:** We successfully turned a standard MIDI file into a spiritual experience where falling notes hit piano keys in real-time, accompanied by custom blooming effects.
* **Premium Auth & File Handling:** Built a fully functional **Google Authentication** flow and a drag-and-drop system that instantly triggers system file browsers for a premium user experience.
* **Dynamic Library Management:** Our "My Sonatas" dashboard isn't hard-coded. It dynamically fetches a user's unique musical collection from the **Supabase** backend, allowing them to revisit their visualizations at any time.

## 📖 What we learned
Building Sakura Sonata taught us that AI is most powerful when used to enhance human creativity and emotion. We learned how to manage real-time data streams—transforming raw MIDI into a fluid visual experience—and how to architect a backend that securely persists a user's musical library. Most importantly, we discovered that the "technical" part of a project (the code) and the "soul" (the aesthetic) must work in perfect harmony.

## ✿ What's next for Sakura Sonata
* **The "AI Sensei" Vision (OMR):** We plan to train a custom **Computer Vision model (OMR)** to read and transcribe physical sheet music (PDF, PNG). Users will be able to snap a photo of a handwritten score and see it bloom into a digital performance.
* **Live Performance Mode:** Plugging in a MIDI keyboard to see petals fall in real-time as you play live.
* **Ensemble Mode:** AI transcription and visualization for multi-instrumental sheets like violin and cello duets.
* **Global Concert Hall:** A gallery where users can share their "Sonata Videos" with the world.

## 🏗 Built With
* Next.js
* TypeScript
* Tailwind CSS
* Supabase
* Framer Motion
