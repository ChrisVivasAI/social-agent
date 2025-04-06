import React from 'react';
import { Link } from 'react-router-dom'; // Assuming we'll use react-router for navigation

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center font-sans">
      {/* Navigation Bar (Optional, can be added later) */}
      {/* <nav className="w-full p-4 bg-gray-800 shadow-md"> ... </nav> */}

      {/* Hero Section */}
      <section className="w-full flex flex-col items-center justify-center text-center py-24 px-4 bg-gradient-to-b from-gray-800 to-gray-900">
        {/* Optional: Placeholder for a logo */}
        {/* <img src="/logo.svg" alt="RAWBBIT Logo" className="h-16 mb-4" /> */}
        <h1 className="text-5xl md:text-6xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">
          RAWBBIT
        </h1>
        <h2 className="text-2xl md:text-3xl font-semibold mb-6 text-gray-300">
          Your AI Agent for Social Media & Research
        </h2>
        <p className="text-lg md:text-xl max-w-3xl mb-8 text-gray-400">
          Effortlessly post to Twitter (X) & LinkedIn, perform research, and manage updates on the go via Discord.
        </p>
        <Link
          to="/app" // Link to the interaction interface (adjust path if needed)
          className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold py-3 px-8 rounded-full text-lg transition duration-300 ease-in-out transform hover:scale-105 shadow-lg"
        >
          Launch Posting Interface
        </Link>
      </section>

      {/* Features Section */}
      <section className="w-full max-w-6xl py-16 px-4">
        <h3 className="text-3xl font-bold text-center mb-12 text-gray-200">Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Feature Card 1 */}
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700 hover:border-cyan-500 transition duration-300">
            {/* Icon Placeholder */}
            <div className="text-cyan-400 mb-4 text-4xl"> {/* Replace with actual icon */}
              &#x1F4AC; {/* Speech Balloon Emoji */}
            </div>
            <h4 className="text-xl font-semibold mb-2 text-gray-100">Automated Posting</h4>
            <p className="text-gray-400">Schedule and publish content seamlessly to Twitter (X) & LinkedIn.</p>
          </div>

          {/* Feature Card 2 */}
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700 hover:border-cyan-500 transition duration-300">
            {/* Icon Placeholder */}
            <div className="text-cyan-400 mb-4 text-4xl"> {/* Replace with actual icon */}
              &#x1F9E0; {/* Brain Emoji */}
            </div>
            <h4 className="text-xl font-semibold mb-2 text-gray-100">AI Research</h4>
            <p className="text-gray-400">Let RAWBBIT gather insights and information for your posts.</p>
          </div>

          {/* Feature Card 3 */}
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700 hover:border-cyan-500 transition duration-300">
            {/* Icon Placeholder */}
            <div className="text-cyan-400 mb-4 text-4xl"> {/* Replace with actual icon */}
              &#x1F4BB; {/* Personal Computer Emoji (representing Discord) */}
            </div>
            <h4 className="text-xl font-semibold mb-2 text-gray-100">Discord Control</h4>
            <p className="text-gray-400">Interact with RAWBBIT anytime, anywhere using simple Discord commands.</p>
          </div>

          {/* Feature Card 4 */}
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700 hover:border-cyan-500 transition duration-300">
            {/* Icon Placeholder */}
            <div className="text-cyan-400 mb-4 text-4xl"> {/* Replace with actual icon */}
              &#x1F4F1; {/* Mobile Phone Emoji */}
            </div>
            <h4 className="text-xl font-semibold mb-2 text-gray-100">On-the-Go Updates</h4>
            <p className="text-gray-400">Quickly post findings discovered while away from your desk via Discord.</p>
          </div>
        </div>
      </section>

      {/* How it Works Section (Placeholder) */}
      <section className="w-full max-w-6xl py-16 px-4 text-center">
        <h3 className="text-3xl font-bold mb-6 text-gray-200">How It Works</h3>
        <p className="text-lg text-gray-400">
          Use the web interface for composing detailed posts and scheduling. For quick interactions, research, and posting on the fly, simply use `/rawbbit` commands in your Discord server.
        </p>
        {/* Add more details or graphics here */}
      </section>

      {/* Footer (Optional) */}
      <footer className="w-full p-4 mt-16 border-t border-gray-700 text-center text-gray-500">
        © {new Date().getFullYear()} RAWBBIT. All rights reserved.
      </footer>
    </div>
  );
};

export default LandingPage; 