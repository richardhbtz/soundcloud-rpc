{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = [
    pkgs.electron
    pkgs.nodejs
    pkgs.bun
  ];
}
