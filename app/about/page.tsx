"use client";

import React from "react";
import Navbar from "@/components/Navbar";
import { Radio_Canada } from "next/font/google";

const radio = Radio_Canada({
  subsets: ["latin"],
  weight: "400",
});

export default function Home() {
  return (
    <div className={`${radio.className} max-w-2xl w-full mx-auto px-6`}>
      <div className="w-full paper-surface">
        <div className="min-h-screen py-10">
          {/* header */}
          <div className="flex flex-row justify-between items-start gap-6">
            <p className="custom-text-18 ink-title">Anthony Bolivar</p>
            <Navbar />
          </div>

          <hr className="rule" />

          {/* headline */}
          <div className="section-title text-base sm:text-lg">
            Hi, Hola, こんにちは, Bonjour!
          </div>

          {/* body */}
          <p className="pt-6 ink-body">
            I&apos;m currently a sophomore Computer Science major at <span className="font-semibold">
              <a className="link-accent" href="https://www.colgate.edu/academics/departments-programs/department-computer-science">
                Colgate
              </a>
            </span>{" "}
             University. I like building software, learning hard things, and I have a budding interest in
            systems + machine learning.
          </p>

          <p className="pt-6 ink-body">
            When I&apos;m not programming, I travel, take photos of my dogs, and
            lift heavy weight!!!
          </p>

          <p className="pt-6 ink-body">
            I&apos;m always open to exploring new opportunities —{" "}
            <span className="font-semibold">
              <a className="link-accent" href="mailto:abolivar@colgate.edu">
                connect here.
              </a>
            </span>
          </p>

          {/* links */}
          <ul className="pt-10 flex flex-row items-center">
            <a
              href="https://github.com/tonybolivar"
              className="pr-5 link-accent"
              target="_blank"
              rel="noreferrer"
            >
              <img src="/github.svg" alt="github" width={26} height={26} />
            </a>

            <a
              href="https://www.linkedin.com/in/anthony-bolivar-22059523b/"
              className="pr-5 link-accent"
              target="_blank"
              rel="noreferrer"
            >
              <img src="/linkedin.svg" alt="linkedin" width={26} height={26} />
            </a>

            <span className="ink-muted text-sm ml-auto">
              :3
            </span>
          </ul>
        </div>
      </div>
    </div>
  );
}
