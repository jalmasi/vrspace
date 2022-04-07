package org.vrspace.server;

import java.math.BigInteger;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.web3j.crypto.Credentials;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.Web3jService;
import org.web3j.protocol.core.DefaultBlockParameterName;
import org.web3j.protocol.core.methods.request.EthFilter;
import org.web3j.protocol.core.methods.response.Log;
import org.web3j.protocol.core.methods.response.TransactionReceipt;
import org.web3j.protocol.http.HttpService;
import org.web3j.tx.Contract;
import org.web3j.tx.ManagedTransaction;
import org.web3j.utils.Numeric;

public class BlockChainTest {
  // three private keys in default installation of besu:
  private String privateKey = "8f2a55949038a9610f50fb23b5883af3b4ecb3c3bb792cbcefbd1542c692be63";
  // "c87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3"
  // "ae6ae8e5ccbfb04590405997ee2d52d2b330726137b875053c36d94e974d162f"
  // three user addresses in default installation of besu:
  private String address = "0xFE3B557E8Fb62b89F4916B721be55cEb828dBd73";
  // "627306090abaB3A6e1400e9345bC60c78a8BEf57"
  // "f17f52151EbEF6C7334FAD080c5704D77216b732"
  private Web3jService web3jService = new HttpService();
  private Web3j web3j = Web3j.build(web3jService);
  private Credentials credentials = Credentials.create(privateKey);
  NameRegistry registry = null;
  private OSNFT contract = null;
  private String registryAddress = "0x8553c57ac9a666eafc517ffc4cf57e21d2d3a1cb";

  @Test
  public void testSomething() throws Exception {
    System.err.println("Loading registry from " + registryAddress);
    registry = NameRegistry.load(registryAddress, web3j, credentials, ManagedTransaction.GAS_PRICE, Contract.GAS_LIMIT);
    if ("0x0000000000000000000000000000000000000000".equals(registry.getContractAddress())) {
      // deploy name registry contract:
      registry = NameRegistry.deploy(web3j, credentials, ManagedTransaction.GAS_PRICE, Contract.GAS_LIMIT).send();
      System.err.println("Registry contract deployed:" + registry.getContractAddress());
    }
    String contentAddr = registry.getContractDetails("test").send();
    System.err.println("Content contract address:" + contentAddr);
    if (isZero(contentAddr)) {
      // deploy content contract:
      contract = OSNFT.deploy(web3j, credentials, ManagedTransaction.GAS_PRICE, Contract.GAS_LIMIT).send();
      registry.registerName("test", contract.getContractAddress()).send();
      System.err.println("Content contract deployed and registered:" + contract.getContractAddress());
    } else {
      contract = OSNFT.load(contentAddr, web3j, credentials, ManagedTransaction.GAS_PRICE, Contract.GAS_LIMIT);
      System.err.println("Content contract loaded:" + contract.getContractAddress());
    }

    // listen to events of the contract
    // filter();

    BigInteger nft1 = mint(contract, "https://www.vrspace.org/objectId/hash1");
    BigInteger nft2 = mint(contract, "https://www.vrspace.org/objectId/hash2");

    listAllTokens(contract);

    contract.burn(nft1).send();
    System.err.println("Burned token " + nft1);

    totalSupply(contract);

    contract.burn(nft2).send();
    System.err.println("Burned token " + nft2);

    totalSupply(contract);
  }

  private boolean isZero(String address) {
    return "0x0000000000000000000000000000000000000000".equals(address);
  }

  private void listAllTokens(OSNFT contract) throws Exception {
    BigInteger total = totalSupply(contract);
    for (BigInteger i = BigInteger.ZERO; i.compareTo(total) < 0; i = i.add(BigInteger.ONE)) {
      BigInteger tokenId = contract.tokenByIndex(i).send();
      String uri = contract.tokenURI(tokenId).send();
      System.err.println("Token " + tokenId + " uri " + uri);
    }
  }

  private BigInteger mint(OSNFT contract, String tokenURI) throws Exception {
    TransactionReceipt receipt = contract.mintNFT(address, tokenURI).send();
    BigInteger id = tokenId(receipt.getLogs());
    System.err
        .println("Minted token " + id + " tran " + receipt.getTransactionHash() + " block " + receipt.getBlockHash());
    return id;
  }

  private BigInteger tokenId(List<Log> logs) throws Exception {
    return tokenId(logs.get(0));
  }

  private BigInteger tokenId(Log log) throws Exception {
    if (log.getTopics().size() <= 3) {
      return BigInteger.ZERO;
    }
    BigInteger ret = Numeric.toBigInt(log.getTopics().get(3));
    if ("0x0000000000000000000000000000000000000000000000000000000000000000".equals(log.getTopics().get(2))) {
      // token deleted
      ret = ret.negate();
    }
    return ret;
  }

  private BigInteger totalSupply(OSNFT contract) throws Exception {
    BigInteger total = contract.totalSupply().send();
    System.err.println("Total tokens available:" + total);
    return total;
  }

  private void filter() {
    EthFilter filter = new EthFilter(DefaultBlockParameterName.EARLIEST, DefaultBlockParameterName.LATEST,
        contract.getContractAddress());

    web3j.ethLogFlowable(filter).subscribe(log -> {
      // log topics:
      // 0 - something
      // 1 - transfer from address, 0 = mint
      // 2 - transfer to address, 0 = burn
      // 3 - optional token id
      System.err.println(log);
      BigInteger tokenId = tokenId(log);
      if (tokenId.compareTo(BigInteger.ZERO) > 0) {
        String uri = contract.tokenURI(tokenId).send();
        System.err.println("Token " + tokenId + " uri " + uri);
      } else if (tokenId.compareTo(BigInteger.ZERO) < 0) {
        System.err.println("Token " + tokenId + " burned");
      }
    });

  }
}