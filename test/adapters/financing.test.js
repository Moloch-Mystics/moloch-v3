
const sha3 = web3.utils.sha3;
const toBN = web3.utils.toBN;
const {advanceTime, createDao, GUILD, sharePrice, BankContract, OnboardingContract, ProposalContract, VotingContract, FinancingContract, ETH_TOKEN} = require('../../utils/DaoFactory.js');
const remaining = sharePrice.sub(toBN('50000000000000'));

contract('MolochV3 - Financing Adapter', async accounts => {
  
  it("should be possible to any individual to request financing", async () => {
    const myAccount = accounts[1];
    const applicant = accounts[2];
    const newMember = accounts[3];

    let dao = await createDao({}, myAccount);
    const bankAddress = await dao.getAddress(sha3("bank"));
    const bank = await BankContract.at(bankAddress);

    const proposalAddress = await dao.getAddress(sha3("proposal"));
    const proposal = await ProposalContract.at(proposalAddress);

    const votingAddress = await dao.getAddress(sha3("voting"));
    const voting = await VotingContract.at(votingAddress);

    const financingAddress = await dao.getAddress(sha3("financing"));
    const financing = await FinancingContract.at(financingAddress);

    //Add funds to the Guild Bank after sposoring a member to join the Guild
    const onboardingAddress = await dao.getAddress(sha3('onboarding'));
    const onboarding = await OnboardingContract.at(onboardingAddress);
    await dao.sendTransaction({ from: newMember, value: sharePrice.mul(toBN(10)).add(remaining), gasPrice: toBN("0") });
    //Get the new proposal id
    pastEvents = await proposal.getPastEvents();
    let { proposalId }  = pastEvents[0].returnValues;

    //Sponsor the new proposal, vote and process it 
    await onboarding.sponsorProposal(dao.address, proposalId, [], { from: myAccount, gasPrice: toBN("0") });
    await voting.submitVote(dao.address, proposalId, 1, { from: myAccount, gasPrice: toBN("0") });
    await advanceTime(10000);
    await onboarding.processProposal(dao.address, proposalId, { from: myAccount, gasPrice: toBN("0") });

    //Check Guild Bank Balance
    let guildBalance = await bank.balanceOf(dao.address, GUILD, ETH_TOKEN);
    let expectedGuildBalance = toBN("1200000000000000000");
    assert.equal(toBN(guildBalance).toString(), expectedGuildBalance.toString());

    //Create Financing Request
    let requestedAmount = toBN(50000);
    await financing.createFinancingRequest(dao.address, applicant, ETH_TOKEN, requestedAmount, web3.utils.fromUtf8(""));
    
    //Get the new proposalId from event log
    pastEvents = await proposal.getPastEvents();
    proposalId = pastEvents[0].returnValues.proposalId;
    assert.equal(proposalId, 1);

    //Member sponsors the Financing proposal
    await financing.sponsorProposal(dao.address, proposalId, [], { from: myAccount, gasPrice: toBN("0") });

    //Member votes on the Financing proposal
    await voting.submitVote(dao.address, proposalId, 1, { from: myAccount, gasPrice: toBN("0") });

    //Check applicant balance before Financing proposal is processed
    let applicantBalance = await bank.balanceOf(dao.address, applicant, ETH_TOKEN);
    assert.equal(toBN(applicantBalance).toString(), "0".toString());
    
    //Process Financing proposal after voting
    await advanceTime(10000);
    await financing.processProposal(dao.address, proposalId, { from: myAccount, gasPrice: toBN("0") });

    //Check Guild Bank balance to make sure the transfer has happened
    guildBalance = await bank.balanceOf(dao.address, GUILD, ETH_TOKEN);
    assert.equal(toBN(guildBalance).toString(), expectedGuildBalance.sub(requestedAmount).toString());

    //Check the applicant token balance to make sure the funds are available in the bank for the applicant account
    applicantBalance = await bank.balanceOf(dao.address, applicant, ETH_TOKEN);
    assert.equal(toBN(applicantBalance).toString(), requestedAmount.toString());
  })
});