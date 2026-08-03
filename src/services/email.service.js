"use strict";

const nodemailer = require("nodemailer");
const env = require("../config/env");
const logger = require("../utils/logger");

let cachedTransporter = null;

const hasSmtpConfig = () =>
  Boolean(env.SMTP_URL || (env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS));

const getTransporter = () => {
  if (!hasSmtpConfig()) return null;
  if (cachedTransporter) return cachedTransporter;

  if (env.SMTP_URL) {
    cachedTransporter = nodemailer.createTransport(env.SMTP_URL);
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT) || 587,
    secure: String(env.SMTP_SECURE).toLowerCase() === "true" || Number(env.SMTP_PORT) === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
  return cachedTransporter;
};

const getFromAddress = () =>
  env.SMTP_FROM || env.SMTP_USER || "Ami-Bridge <no-reply@ami-bridge.local>";

const getAppBaseUrl = (baseUrl) => {
  const fallback = env.APP_URL || `http://localhost:${env.PORT || 5000}`;
  const raw = (baseUrl || fallback).trim();
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
};

const buildResetLink = (baseUrl, token) =>
  `${getAppBaseUrl(baseUrl)}/?reset_token=${encodeURIComponent(token)}`;

const buildWelcomeEmail = (name, role, baseUrl) => {
  const safeName = name || "there";
  const loginUrl = `${getAppBaseUrl(baseUrl)}/`;
  const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : "User";

  return {
    subject: "Welcome to Ami-Bridge",
    text: `Hi ${safeName},\n\nYour Ami-Bridge ${roleLabel.toLowerCase()} account is ready.\nYou can sign in here: ${loginUrl}\n\nIf you did not create this account, please ignore this email.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
        <h2 style="margin:0 0 16px">Welcome to Ami-Bridge</h2>
        <p style="margin:0 0 12px">Hi ${safeName},</p>
        <p style="margin:0 0 12px">
          Your Ami-Bridge ${roleLabel.toLowerCase()} account is ready.
        </p>
        <p style="margin:0 0 16px">
          Sign in here:
          <a href="${loginUrl}" target="_blank" rel="noreferrer">${loginUrl}</a>
        </p>
        <p style="margin:0;color:#475569;font-size:14px">
          If you did not create this account, please ignore this email.
        </p>
      </div>
    `,
  };
};

const buildResetEmail = (name, token, baseUrl) => {
  const safeName = name || "there";
  const resetLink = buildResetLink(baseUrl, token);

  return {
    subject: "Reset your Ami-Bridge password",
    text: `Hi ${safeName},\n\nWe received a request to reset your Ami-Bridge password.\nUse this link to set a new password: ${resetLink}\n\nThis link expires in 1 hour.\nIf you did not request a password reset, you can safely ignore this email.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
        <h2 style="margin:0 0 16px">Reset your password</h2>
        <p style="margin:0 0 12px">Hi ${safeName},</p>
        <p style="margin:0 0 12px">
          We received a request to reset your Ami-Bridge password.
        </p>
        <p style="margin:0 0 20px">
          <a
            href="${resetLink}"
            target="_blank"
            rel="noreferrer"
            style="display:inline-block;padding:12px 18px;border-radius:10px;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700"
          >
            Reset password
          </a>
        </p>
        <p style="margin:0 0 12px">
          Or copy this link into your browser:
          <br />
          <a href="${resetLink}" target="_blank" rel="noreferrer">${resetLink}</a>
        </p>
        <p style="margin:0 0 12px;color:#475569;font-size:14px">
          This link expires in 1 hour.
        </p>
        <p style="margin:0;color:#475569;font-size:14px">
          If you did not request a password reset, you can safely ignore this email.
        </p>
      </div>
    `,
  };
};

const buildVerificationEmail = (name, otp) => {
  const safeName = name || "there";
  const code = String(otp || "").trim();

  return {
    subject: "Your Ami-Bridge verification code",
    text: `Hi ${safeName},\n\nYour Ami-Bridge verification code is ${code}.\nIt expires in 10 minutes.\nIf you did not request this, you can ignore this email.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
        <h2 style="margin:0 0 16px">Verify your email</h2>
        <p style="margin:0 0 12px">Hi ${safeName},</p>
        <p style="margin:0 0 12px">
          Your Ami-Bridge verification code is:
        </p>
        <div
          style="display:inline-block;padding:14px 18px;border-radius:12px;background:#eef2ff;color:#1d4ed8;font-size:24px;font-weight:700;letter-spacing:4px"
        >
          ${code}
        </div>
        <p style="margin:16px 0 0;color:#475569;font-size:14px">
          This code expires in 10 minutes.
        </p>
        <p style="margin:8px 0 0;color:#475569;font-size:14px">
          If you did not request this, you can ignore this email.
        </p>
      </div>
    `,
  };
};

const sendMail = async ({ to, subject, text, html }) => {
  const transporter = getTransporter();
  if (!transporter) {
    return { sent: false, devMode: true };
  }

  await transporter.sendMail({
    from: getFromAddress(),
    to,
    subject,
    text,
    html,
  });

  return { sent: true, devMode: false };
};

const sendWelcomeEmail = async ({ to, name, role, baseUrl }) => {
  const message = buildWelcomeEmail(name, role, baseUrl);
  try {
    return await sendMail({ to, ...message });
  } catch (err) {
    logger.warn("Welcome email failed:", err.message);
    return { sent: false, devMode: !hasSmtpConfig() };
  }
};

const sendResetEmail = async ({ to, name, token, baseUrl }) => {
  const message = buildResetEmail(name, token, baseUrl);
  try {
    const result = await sendMail({ to, ...message });
    return {
      ...result,
      resetLink: buildResetLink(baseUrl, token),
    };
  } catch (err) {
    logger.warn("Password reset email failed:", err.message);
    return {
      sent: false,
      devMode: !hasSmtpConfig(),
      resetLink: buildResetLink(baseUrl, token),
    };
  }
};

const sendVerificationEmail = async ({ to, name, otp }) => {
  const message = buildVerificationEmail(name, otp);
  try {
    const result = await sendMail({ to, ...message });
    logger.info(`Verification email sent via ${result.provider || "local"} to ${to}`);
    return result;
  } catch (err) {
    logger.warn("Verification email failed:", err.message);
    return { sent: false, devMode: !hasEmailConfig() };
  }
};

module.exports = {
  hasSmtpConfig,
  buildResetLink,
  sendWelcomeEmail,
  sendResetEmail,
  sendVerificationEmail,
};
