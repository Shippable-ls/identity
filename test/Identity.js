import assert from 'assert'
import helper from './_helper'

describe('Identity', async function() {
  var web3, accounts, deploy, acctSha3, randomHex
  var UserIdentity

  before(async function() {
    ({ web3, deploy, accounts, web3: { utils: { randomHex } } } = await helper(
      `${__dirname}/../contracts/`
    ))

    UserIdentity = await deploy('ClaimHolder', { from: accounts[0] })
    acctSha3 = web3.utils.keccak256(accounts[0])
  })

  describe('Keys', async function() {
    it('should set a default MANAGEMENT_KEY', async function() {
      var res = await UserIdentity.methods.getKey(acctSha3).call()
      assert.equal(res.purpose, '1')
      assert.equal(res.keyType, '1')
      assert.equal(res.key, acctSha3)
    })

    it('should respond to getKeyPurpose', async function() {
      var res = await UserIdentity.methods.getKeyPurpose(acctSha3).call()
      assert.equal(res, '1')
    })

    it('should respond to getKeysByPurpose', async function() {
      var res = await UserIdentity.methods.getKeysByPurpose(1).call()
      assert.deepEqual(res, [acctSha3])
    })

    it('should implement addKey', async function() {
      var newKey = web3.utils.randomHex(32)
      var res = await UserIdentity.methods.addKey(newKey, 1, 1).send()
      assert(res.events.KeyAdded)

      var getKey = await UserIdentity.methods.getKey(newKey).call()
      assert.equal(getKey.key, newKey)
    })

    it('should not allow an existing key to be added', async function() {
      try {
        await UserIdentity.methods.addKey(acctSha3, 1, 1).send()
        assert(false)
      } catch (e) {
        assert(e.message.match(/revert/))
      }
    })

    it('should not allow sender without MANAGEMENT_KEY to addKey', async function() {
      try {
        await UserIdentity.methods.addKey(web3.utils.randomHex(32), 1, 1).send({
          from: accounts[1]
        })
        assert(false)
      } catch (e) {
        assert(e.message.match(/revert/))
      }
    })
  })

  describe('Claims', async function() {
    it('should allow a claim to be added by management account', async function() {
      var response = await UserIdentity.methods
        .addClaim(1, 2, accounts[0], randomHex(32), randomHex(32), 'abc.com')
        .send()
      assert(response.events.ClaimAdded)
    })

    it('should disallow new claims from unrecognized accounts', async function() {
      try {
        await UserIdentity.methods
          .addClaim(1, 2, accounts[0], randomHex(32), randomHex(32), 'abc.com')
          .send({ from: accounts[2] })
        assert(false)
      } catch (e) {
        assert(e.message.match(/revert/))
      }
    })

    it('should have 1 claim by type', async function() {
      var byTypeRes = await UserIdentity.methods.getClaimIdsByType(1).call()
      assert.equal(byTypeRes.length, 1)
    })
  })

  describe('Executions', async function() {
    it('should allow any account to execute actions', async function() {
      var addClaimAbi = await UserIdentity.methods
        .addClaim(1, 2, accounts[0], randomHex(32), randomHex(32), 'abc.com')
        .encodeABI()

      var response = await UserIdentity.methods
        .execute(UserIdentity.options.address, 0, addClaimAbi)
        .send({
          from: accounts[2]
        })

      assert(response.events.ExecutionRequested)
      assert(!response.events.Approved)
      assert(!response.events.Executed)
    })

    it('should auto-approve executions from MANAGEMENT_KEYs', async function() {
      var addClaimAbi = await UserIdentity.methods
        .addClaim(1, 2, accounts[0], randomHex(32), randomHex(32), 'abc.com')
        .encodeABI()

      var response = await UserIdentity.methods
        .execute(UserIdentity.options.address, 0, addClaimAbi)
        .send({
          from: accounts[0]
        })

      assert(response.events.ExecutionRequested)
      assert(response.events.Approved)
      assert(response.events.ClaimAdded)
      assert(response.events.Executed)
    })
  })

  describe('Approvals', async function() {
    it('should allow MANAGEMENT_KEYs to approve executions', async function() {
      var addClaimAbi = await UserIdentity.methods
        .addClaim(1, 2, accounts[2], randomHex(32), randomHex(32), 'abc.com')
        .encodeABI()

      var response = await UserIdentity.methods
        .execute(UserIdentity.options.address, 0, addClaimAbi)
        .send({ from: accounts[2] })

      assert(response.events.ExecutionRequested)
      assert(!response.events.Approved)

      var id = response.events.ExecutionRequested.returnValues.executionId;

      var approval = await UserIdentity.methods.approve(id, true)
        .send({ from: accounts[0] })

      assert(approval.events.Approved)
      assert(approval.events.ClaimAdded)
      assert(approval.events.Executed)
    })

    it('should allow ACTION_KEYs to approve executions')
    it('should not allow CLAIM_SIGNER_KEYs to approve executions')
  })
})
