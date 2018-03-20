pragma solidity ^0.4.18;

import './ClaimHolder.sol';

contract ClaimVerifier {

  event ClaimValid();
  event ClaimInvalid();

  ClaimHolder public trustedClaimHolder;

  function ClaimVerifier(address _trustedClaimHolder) public {
    trustedClaimHolder = ClaimHolder(_trustedClaimHolder);
  }

  function checkClaim(ClaimHolder _identity, uint256 claimType)
    public
    returns (bool claimValid)
  {
    uint256 foundClaimType;
    uint256 scheme;
    address issuer;

    // Construct claimId (identifier + claim type)
    bytes32 claimId = keccak256(trustedClaimHolder, claimType);

    // Fetch claim from user
    ( foundClaimType, scheme, issuer, ) = _identity.getClaim(claimId);

    // Recover address of data signer
    address recovered = getRecoveredAddress(_identity, claimId);

    // Take hash of recovered address
    bytes32 hashedAddr = keccak256(recovered);

    // Does the trusted identifier have they key which signed the user's claim?
    if (trustedClaimHolder.keyHasPurpose(hashedAddr, 1)) {
      emit ClaimValid();
      return true;
    } else {
      emit ClaimInvalid();
      return false;
    }
  }

  function getRecoveredAddress(ClaimHolder _identity, bytes32 claimId)
      public
      view
      returns (address addr)
  {
    bytes32 dataHash;
    bytes32 sig_r;
    bytes32 sig_s;
    uint8 sig_v;

    (dataHash, sig_r, sig_s, sig_v ) = _identity.getClaimSig(claimId);

    address recoveredAddress = ecrecover(dataHash, sig_v, sig_r, sig_s);
    return (recoveredAddress);
  }

}
